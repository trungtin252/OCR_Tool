import { createHash, randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  rename,
  stat,
  statfs,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { appConfig } from "@backend/config/env";

export type OcrInteractionType =
  | "OCR_VAT_TU"
  | "OCR_CHUNG_TU"
  | "OCR_GIAY_VUNG_TRONG";
export type OcrArchiveStatus = "saved" | "failed" | "disabled";

export interface OcrArchiveInputFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

export interface BeginOcrArchiveInput {
  interactionType: OcrInteractionType;
  taskSubtype: string;
  endpoint: string;
  query: Readonly<Record<string, unknown>>;
  apiContractVersion: string;
  files: readonly OcrArchiveInputFile[];
}

interface ArchivedFileMetadata {
  original_name: string;
  mime_type: string;
  size_bytes: number;
  sha256: string;
  stored_path: string;
}

export interface OcrArchiveHandle {
  id: string;
  createdAt: Date;
  pendingDirectory: string;
  input: Omit<BeginOcrArchiveInput, "files">;
  files: ArchivedFileMetadata[];
}

export type BeginOcrArchiveResult =
  | { status: "pending"; handle: OcrArchiveHandle }
  | { status: "disabled" | "failed" };

export interface CompleteOcrArchiveInput {
  httpStatus: number;
  responseBody: unknown;
  taskSubtype?: string;
}

export interface OcrArchiveConfig {
  enabled: boolean;
  directory: string;
  minFreeBytes: number;
  now?: () => Date;
  idFactory?: () => string;
  availableBytes?: (directory: string) => Promise<number>;
}

const MIME_EXTENSIONS: Readonly<Record<string, string>> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
};

const STALE_PENDING_MS = 60 * 60 * 1_000;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function logArchiveFailure(
  operation: string,
  error: unknown,
  interactionId?: string,
): void {
  console.error("ARCHIVE_WRITE_FAILED", {
    operation,
    interaction_id: interactionId ?? null,
    message: errorMessage(error),
  });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parsePossibleJson(value: unknown): unknown {
  if (typeof value !== "string") return value;

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return { response: value };
  }
}

export function extractNormalizedOcrOutput(responseBody: unknown): unknown {
  const body = asRecord(responseBody);
  const data = asRecord(body?.data);
  return data && "response" in data
    ? parsePossibleJson(data.response)
    : responseBody;
}

function getNestedValue(value: unknown, ...keys: string[]): unknown {
  let current: unknown = value;
  for (const key of keys) {
    current = asRecord(current)?.[key];
  }
  return current;
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

function getConfidence(normalized: unknown): number | null {
  const candidates = [
    getNestedValue(normalized, "metadata", "overall_confidence"),
    getNestedValue(normalized, "confidence"),
  ];
  return (
    candidates.find(
      (value): value is number =>
        typeof value === "number" && Number.isFinite(value),
    ) ?? null
  );
}

function isFailedResponse(httpStatus: number, responseBody: unknown): boolean {
  if (httpStatus >= 400) return true;
  const body = asRecord(responseBody);
  const normalized = asRecord(extractNormalizedOcrOutput(responseBody));
  return body?.success === false || normalized?.success === false;
}

function compactUtcTimestamp(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

async function defaultAvailableBytes(directory: string): Promise<number> {
  const filesystem = await statfs(directory);
  const available = BigInt(filesystem.bavail) * BigInt(filesystem.bsize);
  return available > BigInt(Number.MAX_SAFE_INTEGER)
    ? Number.MAX_SAFE_INTEGER
    : Number(available);
}

async function writeJsonAtomically(
  filename: string,
  value: unknown,
): Promise<void> {
  const temporaryFilename = `${filename}.${randomUUID()}.tmp`;
  const serialized = `${JSON.stringify(value, null, 2)}\n`;
  await writeFile(temporaryFilename, serialized, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
  await rename(temporaryFilename, filename);
}

function getFileExtension(mimetype: string): string {
  const extension = MIME_EXTENSIONS[mimetype.toLowerCase()];
  if (!extension) throw new Error(`Unsupported archive MIME type: ${mimetype}`);
  return extension;
}

function buildInteraction(
  handle: OcrArchiveHandle,
  completedAt: Date | null,
  httpStatus: number | null,
  status: "PROCESSING" | "SUCCEEDED" | "FAILED" | "INTERRUPTED",
  responseBody: unknown,
  taskSubtype: string,
): Record<string, unknown> {
  const normalized = extractNormalizedOcrOutput(responseBody);
  const body = asRecord(responseBody);
  const normalizedRecord = asRecord(normalized);
  const failed = status === "FAILED";

  return {
    schema_version: "ocr-archive.v1",
    id: handle.id,
    created_at: handle.createdAt.toISOString(),
    completed_at: completedAt?.toISOString() ?? null,
    loai_tuong_tac: handle.input.interactionType,
    task_subtype: taskSubtype,
    input_type: handle.files.length > 1 ? "MULTI" : "IMAGE",
    endpoint: handle.input.endpoint,
    query: handle.input.query,
    http_status: httpStatus,
    ocr_status: status,
    error_code: failed
      ? firstString(normalizedRecord?.error_code, body?.error_code, body?.error)
      : null,
    input_files: handle.files,
    input_raw: null,
    transcript_raw: null,
    normalized_input: {
      endpoint: handle.input.endpoint,
      query: handle.input.query,
      file_count: handle.files.length,
    },
    reply_text: firstString(normalizedRecord?.message, body?.message),
    tts_message: null,
    model_name: null,
    model_version: null,
    confidence: getConfidence(normalized),
    user_confirmed: null,
    user_correction: null,
    api_contract_version: handle.input.apiContractVersion,
  };
}

export class FilesystemOcrArchive {
  private readonly now: () => Date;
  private readonly idFactory: () => string;
  private readonly availableBytes: (directory: string) => Promise<number>;

  constructor(private readonly config: OcrArchiveConfig) {
    this.now = config.now ?? (() => new Date());
    this.idFactory = config.idFactory ?? randomUUID;
    this.availableBytes = config.availableBytes ?? defaultAvailableBytes;
  }

  async begin(input: BeginOcrArchiveInput): Promise<BeginOcrArchiveResult> {
    if (!this.config.enabled) return { status: "disabled" };

    const id = this.idFactory();
    try {
      await mkdir(this.config.directory, { recursive: true });
      const availableBytes = await this.availableBytes(this.config.directory);
      const requiredBytes = input.files.reduce(
        (total, file) => total + file.buffer.length,
        0,
      );
      if (availableBytes - requiredBytes < this.config.minFreeBytes) {
        throw new Error(
          `Insufficient free space: ${availableBytes} bytes available`,
        );
      }

      const pendingDirectory = path.join(this.config.directory, ".pending", id);
      const filesDirectory = path.join(pendingDirectory, "files");
      await mkdir(filesDirectory, { recursive: true });

      const archivedFiles: ArchivedFileMetadata[] = [];
      for (const [index, file] of input.files.entries()) {
        const physicalName = `${String(index + 1).padStart(3, "0")}${getFileExtension(file.mimetype)}`;
        const storedPath = path.posix.join("files", physicalName);
        await writeFile(path.join(filesDirectory, physicalName), file.buffer, {
          flag: "wx",
          mode: 0o600,
        });
        archivedFiles.push({
          original_name: file.originalname,
          mime_type: file.mimetype.toLowerCase(),
          size_bytes: file.buffer.length,
          sha256: createHash("sha256").update(file.buffer).digest("hex"),
          stored_path: storedPath,
        });
      }

      const handle: OcrArchiveHandle = {
        id,
        createdAt: this.now(),
        pendingDirectory,
        input: {
          interactionType: input.interactionType,
          taskSubtype: input.taskSubtype,
          endpoint: input.endpoint,
          query: input.query,
          apiContractVersion: input.apiContractVersion,
        },
        files: archivedFiles,
      };
      await writeJsonAtomically(
        path.join(pendingDirectory, "interaction.json"),
        buildInteraction(
          handle,
          null,
          null,
          "PROCESSING",
          null,
          input.taskSubtype,
        ),
      );
      return { status: "pending", handle };
    } catch (error) {
      logArchiveFailure("begin", error, id);
      return { status: "failed" };
    }
  }

  async complete(
    handle: OcrArchiveHandle,
    input: CompleteOcrArchiveInput,
  ): Promise<OcrArchiveStatus> {
    try {
      const completedAt = this.now();
      const taskSubtype = input.taskSubtype ?? handle.input.taskSubtype;
      const status = isFailedResponse(input.httpStatus, input.responseBody)
        ? "FAILED"
        : "SUCCEEDED";
      const normalized = extractNormalizedOcrOutput(input.responseBody);

      await writeJsonAtomically(
        path.join(handle.pendingDirectory, "ai-output.json"),
        input.responseBody,
      );
      await writeJsonAtomically(
        path.join(handle.pendingDirectory, "normalized.json"),
        normalized,
      );
      await writeJsonAtomically(
        path.join(handle.pendingDirectory, "interaction.json"),
        buildInteraction(
          handle,
          completedAt,
          input.httpStatus,
          status,
          input.responseBody,
          taskSubtype,
        ),
      );

      const year = String(handle.createdAt.getUTCFullYear());
      const month = String(handle.createdAt.getUTCMonth() + 1).padStart(2, "0");
      const day = String(handle.createdAt.getUTCDate()).padStart(2, "0");
      const destinationParent = path.join(
        this.config.directory,
        year,
        month,
        day,
      );
      await mkdir(destinationParent, { recursive: true });
      await rename(
        handle.pendingDirectory,
        path.join(
          destinationParent,
          `${compactUtcTimestamp(handle.createdAt)}_${handle.id}`,
        ),
      );
      return "saved";
    } catch (error) {
      logArchiveFailure("complete", error, handle.id);
      return "failed";
    }
  }

  async recoverStalePending(): Promise<void> {
    if (!this.config.enabled) return;

    const pendingRoot = path.join(this.config.directory, ".pending");
    let entries;
    try {
      entries = await readdir(pendingRoot, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      logArchiveFailure("recover-list", error);
      return;
    }

    const cutoff = this.now().getTime() - STALE_PENDING_MS;
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const pendingDirectory = path.join(pendingRoot, entry.name);
      try {
        const directoryStat = await stat(pendingDirectory);
        if (directoryStat.mtimeMs > cutoff) continue;

        const interactionPath = path.join(pendingDirectory, "interaction.json");
        let interaction: Record<string, unknown>;
        try {
          interaction = JSON.parse(
            await readFile(interactionPath, "utf8"),
          ) as Record<string, unknown>;
        } catch (error) {
          logArchiveFailure("recover-manifest", error, entry.name);
          interaction = {
            schema_version: "ocr-archive.v1",
            id: entry.name,
            created_at: directoryStat.birthtime.toISOString(),
          };
        }
        await writeJsonAtomically(interactionPath, {
          ...interaction,
          completed_at: this.now().toISOString(),
          ocr_status: "INTERRUPTED",
          error_code: "PROCESS_INTERRUPTED",
        });

        const incompleteRoot = path.join(this.config.directory, "incomplete");
        await mkdir(incompleteRoot, { recursive: true });
        await rename(
          pendingDirectory,
          path.join(incompleteRoot, entry.name),
        );
      } catch (error) {
        logArchiveFailure("recover-entry", error, entry.name);
      }
    }
  }
}

export const ocrArchive = new FilesystemOcrArchive({
  enabled: appConfig.ocrArchiveEnabled,
  directory: appConfig.ocrArchiveDir,
  minFreeBytes: appConfig.ocrArchiveMinFreeBytes,
});
