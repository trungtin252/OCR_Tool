import { randomUUID } from "node:crypto";
import {
  access,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

export const OCR_HISTORY_STATUSES = [
  "SUCCEEDED",
  "FAILED",
  "INTERRUPTED",
  "UNKNOWN",
] as const;

export const OCR_INTERACTION_TYPES = [
  "OCR_VAT_TU",
  "OCR_CHUNG_TU",
  "OCR_GIAY_VUNG_TRONG",
] as const;

export type OcrHistoryStatus = (typeof OCR_HISTORY_STATUSES)[number];
export type OcrInteractionType = (typeof OCR_INTERACTION_TYPES)[number];

export interface OcrHistoryFile {
  index: number;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  sha256: string | null;
}

export interface OcrHistoryItem {
  id: string;
  created_at: string | null;
  completed_at: string | null;
  loai_tuong_tac: string | null;
  task_subtype: string | null;
  endpoint: string | null;
  ocr_status: OcrHistoryStatus;
  http_status: number | null;
  confidence: number | null;
  error_code: string | null;
  user_confirmed: boolean | null;
  user_correction: string | null;
  reviewed_at: string | null;
  file_count: number;
  files: OcrHistoryFile[];
  parse_warning: string | null;
}

export interface OcrHistoryListOptions {
  page: number;
  pageSize: number;
  query?: string | undefined;
  status?: OcrHistoryStatus | undefined;
  interactionType?: OcrInteractionType | undefined;
  taskSubtype?: string | undefined;
  from?: Date | undefined;
  to?: Date | undefined;
}

export interface OcrHistoryListResult {
  items: OcrHistoryItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface OcrHistoryDetail {
  item: OcrHistoryItem;
  interaction: unknown;
  normalized_output: unknown;
  raw_output: unknown;
}

export interface OcrTrashItem {
  trash_id: string;
  trashed_at: string | null;
  size_bytes: number;
  item: OcrHistoryItem;
}

export interface OcrTrashListResult {
  items: OcrTrashItem[];
  total: number;
  total_size_bytes: number;
  page: number;
  page_size: number;
}

export interface OcrHistoryFileContent {
  absolutePath: string;
  originalName: string;
  mimeType: string;
}

export interface OcrHistoryReviewInput {
  userConfirmed: boolean;
  userCorrection: string | null;
}

interface ArchiveInputFile {
  original_name?: unknown;
  mime_type?: unknown;
  size_bytes?: unknown;
  sha256?: unknown;
  stored_path?: unknown;
}

interface ArchiveRecord {
  directory: string;
  item: OcrHistoryItem;
  interaction: unknown;
  inputFiles: ArchiveInputFile[];
}

interface TrashRecord extends OcrTrashItem {
  directory: string;
}

const SAFE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,199}$/;
const TRASH_ENTRY_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{9}Z_[0-9a-f-]{36}_[A-Za-z0-9][A-Za-z0-9_-]{0,199}$/i;
const DATE_DIRECTORY_PATTERN = /^\d{2}$/;
const YEAR_DIRECTORY_PATTERN = /^\d{4}$/;
const STORED_FILENAME_PATTERN = /^\d{3}\.(?:jpg|png|gif|webp|pdf)$/i;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function isKnownStatus(value: unknown): value is OcrHistoryStatus {
  return (
    typeof value === "string" &&
    (OCR_HISTORY_STATUSES as readonly string[]).includes(value)
  );
}

function parseJson(value: string): unknown {
  return JSON.parse(value) as unknown;
}

async function writeJsonAtomically(filename: string, value: unknown): Promise<void> {
  const temporaryFilename = `${filename}.${randomUUID()}.tmp`;
  await writeFile(temporaryFilename, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
  await rename(temporaryFilename, filename);
}

function safeFallbackId(directory: string): string {
  const candidate = path.basename(directory);
  return SAFE_ID_PATTERN.test(candidate) ? candidate : "unknown";
}

function parseFiles(value: unknown): {
  files: OcrHistoryFile[];
  inputFiles: ArchiveInputFile[];
} {
  if (!Array.isArray(value)) return { files: [], inputFiles: [] };

  const inputFiles = value.map((file) => asRecord(file) ?? {});
  return {
    inputFiles,
    files: inputFiles.map((file, index) => ({
      index,
      original_name: asString(file.original_name) ?? `Tệp ${index + 1}`,
      mime_type: asString(file.mime_type) ?? "application/octet-stream",
      size_bytes: asFiniteNumber(file.size_bytes) ?? 0,
      sha256: asString(file.sha256),
    })),
  };
}

function historyItemFromInteraction(
  interaction: unknown,
  directory: string,
  parseWarning: string | null,
): { item: OcrHistoryItem; inputFiles: ArchiveInputFile[] } {
  const manifest = asRecord(interaction) ?? {};
  const parsedFiles = parseFiles(manifest.input_files);
  const manifestId = asString(manifest.id);
  const fallbackId = safeFallbackId(directory);
  const id = manifestId && SAFE_ID_PATTERN.test(manifestId) ? manifestId : fallbackId;

  return {
    inputFiles: parsedFiles.inputFiles,
    item: {
      id,
      created_at: asString(manifest.created_at),
      completed_at: asString(manifest.completed_at),
      loai_tuong_tac: asString(manifest.loai_tuong_tac),
      task_subtype: asString(manifest.task_subtype),
      endpoint: asString(manifest.endpoint),
      ocr_status: isKnownStatus(manifest.ocr_status)
        ? manifest.ocr_status
        : "UNKNOWN",
      http_status: asFiniteNumber(manifest.http_status),
      confidence: asFiniteNumber(manifest.confidence),
      error_code: asString(manifest.error_code),
      user_confirmed: asBoolean(manifest.user_confirmed),
      user_correction: asString(manifest.user_correction),
      reviewed_at: asString(manifest.reviewed_at),
      file_count: parsedFiles.files.length,
      files: parsedFiles.files,
      parse_warning: parseWarning,
    },
  };
}

function parseCreatedAt(value: string | null): number {
  if (!value) return 0;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function isNotFound(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === "ENOENT";
}

function isConflict(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException).code;
  return code === "EBUSY" || code === "ENOTEMPTY" || code === "EEXIST";
}

export function isValidOcrHistoryId(id: string): boolean {
  return SAFE_ID_PATTERN.test(id);
}

export function isValidOcrTrashEntryId(id: string): boolean {
  return TRASH_ENTRY_PATTERN.test(id);
}

function parseTrashedAt(entryName: string): string | null {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2})(\d{2})(\d{2})(\d{3})Z_/.exec(entryName);
  if (!match) return null;
  return `${match[1]}T${match[2]}:${match[3]}:${match[4]}.${match[5]}Z`;
}

export class OcrHistoryService {
  constructor(private readonly archiveDirectory: string) {}

  async list(options: OcrHistoryListOptions): Promise<OcrHistoryListResult> {
    const records = await this.scanRecords();
    const query = options.query?.trim().toLocaleLowerCase();
    const filtered = records.filter(({ item, interaction }) => {
      if (asRecord(interaction)?.ocr_status === "PROCESSING") return false;
      if (options.status && item.ocr_status !== options.status) return false;
      if (
        options.interactionType &&
        item.loai_tuong_tac !== options.interactionType
      ) {
        return false;
      }
      if (options.taskSubtype && item.task_subtype !== options.taskSubtype) {
        return false;
      }
      const createdAt = parseCreatedAt(item.created_at);
      if (options.from && createdAt < options.from.getTime()) return false;
      if (options.to && createdAt > options.to.getTime()) return false;
      if (!query) return true;
      return (
        item.id.toLocaleLowerCase().includes(query) ||
        item.files.some((file) =>
          file.original_name.toLocaleLowerCase().includes(query),
        )
      );
    });

    filtered.sort(
      (left, right) =>
        parseCreatedAt(right.item.created_at) - parseCreatedAt(left.item.created_at),
    );

    const start = (options.page - 1) * options.pageSize;
    return {
      items: filtered.slice(start, start + options.pageSize).map(({ item }) => item),
      total: filtered.length,
      page: options.page,
      page_size: options.pageSize,
    };
  }

  async detail(id: string): Promise<OcrHistoryDetail | null> {
    const record = await this.findById(id);
    if (!record) return null;
    return {
      item: record.item,
      interaction: record.interaction,
      normalized_output: await this.readOptionalJson(
        path.join(record.directory, "normalized.json"),
      ),
      raw_output: await this.readOptionalJson(
        path.join(record.directory, "ai-output.json"),
      ),
    };
  }

  async file(id: string, index: number): Promise<OcrHistoryFileContent | null> {
    if (!Number.isSafeInteger(index) || index < 0) return null;
    const record = await this.findById(id);
    if (!record) return null;
    const archivedFile = record.inputFiles[index];
    if (!archivedFile) return null;

    const storedPath = asString(archivedFile.stored_path);
    const filename = storedPath ? path.basename(storedPath) : "";
    if (!STORED_FILENAME_PATTERN.test(filename)) return null;
    const absolutePath = path.join(record.directory, "files", filename);
    try {
      await access(absolutePath);
    } catch {
      return null;
    }

    return {
      absolutePath,
      originalName: asString(archivedFile.original_name) ?? filename,
      mimeType: asString(archivedFile.mime_type) ?? "application/octet-stream",
    };
  }

  async listTrash(page: number, pageSize: number): Promise<OcrTrashListResult> {
    const records = await this.scanTrashRecords();
    records.sort(
      (left, right) =>
        parseCreatedAt(right.trashed_at) - parseCreatedAt(left.trashed_at),
    );
    const start = (page - 1) * pageSize;
    return {
      items: records.slice(start, start + pageSize).map(({ directory, ...item }) => item),
      total: records.length,
      total_size_bytes: records.reduce((total, record) => total + record.size_bytes, 0),
      page,
      page_size: pageSize,
    };
  }

  async trash(id: string): Promise<"moved" | "not_found" | "conflict"> {
    const record = await this.findById(id);
    if (!record) return "not_found";
    const trashDirectory = path.join(this.archiveDirectory, ".trash");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "");
    const destination = path.join(
      trashDirectory,
      `${timestamp}_${randomUUID()}_${path.basename(record.directory)}`,
    );
    try {
      await mkdir(trashDirectory, { recursive: true });
      await rename(record.directory, destination);
      return "moved";
    } catch (error) {
      if (isNotFound(error)) return "not_found";
      if (isConflict(error)) return "conflict";
      throw error;
    }
  }

  async purgeTrash(
    trashId: string,
  ): Promise<"deleted" | "not_found" | "conflict"> {
    if (!isValidOcrTrashEntryId(trashId)) return "not_found";
    const record = (await this.scanTrashRecords()).find(
      (candidate) => candidate.trash_id === trashId,
    );
    if (!record) return "not_found";
    try {
      await rm(record.directory, {
        recursive: true,
        force: false,
        maxRetries: 2,
        retryDelay: 100,
      });
      return "deleted";
    } catch (error) {
      if (isNotFound(error)) return "not_found";
      if (isConflict(error)) return "conflict";
      throw error;
    }
  }

  async review(
    id: string,
    input: OcrHistoryReviewInput,
  ): Promise<
    | { status: "saved"; item: OcrHistoryItem }
    | { status: "not_found" | "conflict" }
  > {
    const record = await this.findById(id);
    if (!record) return { status: "not_found" };
    const interaction = asRecord(record.interaction);
    if (!interaction) return { status: "conflict" };

    const reviewedAt = new Date().toISOString();
    const updatedInteraction = {
      ...interaction,
      user_confirmed: input.userConfirmed,
      user_correction: input.userConfirmed ? null : input.userCorrection,
      reviewed_at: reviewedAt,
    };
    try {
      await writeJsonAtomically(
        path.join(record.directory, "interaction.json"),
        updatedInteraction,
      );
      return {
        status: "saved",
        item: historyItemFromInteraction(
          updatedInteraction,
          record.directory,
          record.item.parse_warning,
        ).item,
      };
    } catch (error) {
      if (isNotFound(error)) return { status: "not_found" };
      if (isConflict(error)) return { status: "conflict" };
      throw error;
    }
  }

  private async findById(id: string): Promise<ArchiveRecord | null> {
    if (!isValidOcrHistoryId(id)) return null;
    const records = await this.scanRecords();
    return records.find((record) => record.item.id === id) ?? null;
  }

  private async scanTrashRecords(): Promise<TrashRecord[]> {
    const trashDirectory = path.join(this.archiveDirectory, ".trash");
    const entries = (await this.readDirectories(trashDirectory)).filter(
      isValidOcrTrashEntryId,
    );
    return Promise.all(
      entries.map(async (trashId) => {
        const directory = path.join(trashDirectory, trashId);
        const [record, sizeBytes] = await Promise.all([
          this.recordFromDirectory(directory),
          this.directorySizeBytes(directory),
        ]);
        return {
          trash_id: trashId,
          trashed_at: parseTrashedAt(trashId),
          size_bytes: sizeBytes,
          item: record.item,
          directory,
        };
      }),
    );
  }

  private async scanRecords(): Promise<ArchiveRecord[]> {
    const records: ArchiveRecord[] = [];
    await Promise.all([
      this.scanCompletedRecords(records),
      this.scanIncompleteRecords(records),
    ]);
    return records;
  }

  private async scanCompletedRecords(records: ArchiveRecord[]): Promise<void> {
    const years = await this.readDirectories(this.archiveDirectory, YEAR_DIRECTORY_PATTERN);
    for (const year of years) {
      const yearDirectory = path.join(this.archiveDirectory, year);
      const months = await this.readDirectories(yearDirectory, DATE_DIRECTORY_PATTERN);
      for (const month of months) {
        const monthDirectory = path.join(yearDirectory, month);
        const days = await this.readDirectories(monthDirectory, DATE_DIRECTORY_PATTERN);
        for (const day of days) {
          const dayDirectory = path.join(monthDirectory, day);
          const interactions = await this.readDirectories(dayDirectory);
          for (const interaction of interactions) {
            records.push(
              await this.recordFromDirectory(path.join(dayDirectory, interaction)),
            );
          }
        }
      }
    }
  }

  private async scanIncompleteRecords(records: ArchiveRecord[]): Promise<void> {
    const incompleteDirectory = path.join(this.archiveDirectory, "incomplete");
    const interactions = await this.readDirectories(incompleteDirectory);
    for (const interaction of interactions) {
      records.push(
        await this.recordFromDirectory(path.join(incompleteDirectory, interaction)),
      );
    }
  }

  private async readDirectories(
    directory: string,
    namePattern?: RegExp,
  ): Promise<string[]> {
    try {
      const entries = await readdir(directory, { withFileTypes: true });
      return entries
        .filter(
          (entry) => entry.isDirectory() && (!namePattern || namePattern.test(entry.name)),
        )
        .map((entry) => entry.name);
    } catch (error) {
      if (isNotFound(error)) return [];
      throw error;
    }
  }

  private async recordFromDirectory(directory: string): Promise<ArchiveRecord> {
    let interaction: unknown = null;
    let parseWarning: string | null = null;
    try {
      interaction = parseJson(
        await readFile(path.join(directory, "interaction.json"), "utf8"),
      );
    } catch (error) {
      parseWarning = isNotFound(error)
        ? "Thiếu interaction.json"
        : "Không đọc được interaction.json";
    }
    const parsed = historyItemFromInteraction(interaction, directory, parseWarning);
    return {
      directory,
      item: parsed.item,
      interaction,
      inputFiles: parsed.inputFiles,
    };
  }

  private async directorySizeBytes(directory: string): Promise<number> {
    let total = 0;
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        total += await this.directorySizeBytes(entryPath);
      } else if (entry.isFile()) {
        total += (await stat(entryPath)).size;
      }
    }
    return total;
  }

  private async readOptionalJson(filename: string): Promise<unknown> {
    try {
      return parseJson(await readFile(filename, "utf8"));
    } catch (error) {
      if (isNotFound(error)) return null;
      return {
        parse_warning: "Không đọc được tệp JSON archive",
      };
    }
  }
}
