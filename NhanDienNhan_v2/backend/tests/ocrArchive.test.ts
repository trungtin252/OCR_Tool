import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, stat, utimes } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import express from "express";
import {
  FilesystemOcrArchive,
  type BeginOcrArchiveInput,
} from "../src/shared/archive/ocrArchive.js";
import { createOcrArchiveMiddleware } from "../src/shared/archive/ocrArchive.middleware.js";

const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43]);

async function readJson(filename: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(filename, "utf8")) as Record<
    string,
    unknown
  >;
}

function input(originalname = "label.jpg"): BeginOcrArchiveInput {
  return {
    interactionType: "OCR_VAT_TU",
    taskSubtype: "pesticide",
    endpoint: "/api/image/analyze",
    query: { category: "pesticide", parsed: "true" },
    apiContractVersion: "product.v1",
    files: [
      {
        buffer: JPEG_BYTES,
        mimetype: "image/jpeg",
        originalname,
        size: JPEG_BYTES.length,
      },
    ],
  };
}

test("archive stores original bytes, hashes and response without trusting filenames", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "ocr-archive-"));
  const now = new Date("2026-09-03T08:30:00.000Z");
  const archive = new FilesystemOcrArchive({
    enabled: true,
    directory,
    minFreeBytes: 0,
    now: () => now,
    idFactory: () => "123e4567-e89b-12d3-a456-426614174000",
    availableBytes: async () => 10_000_000,
  });

  try {
    const started = await archive.begin(input("../../outside.jpg"));
    assert.equal(started.status, "pending");
    if (started.status !== "pending") return;

    const responseBody = {
      success: true,
      data: {
        response: JSON.stringify({
          success: true,
          message: "Extracted",
          data: { product_name: "Test" },
          metadata: { overall_confidence: 0.91 },
        }),
        totalImages: 1,
      },
    };
    assert.equal(
      await archive.complete(started.handle, {
        httpStatus: 200,
        responseBody,
      }),
      "saved",
    );

    const interactionDirectory = path.join(
      directory,
      "2026",
      "09",
      "03",
      "20260903T083000Z_123e4567-e89b-12d3-a456-426614174000",
    );
    assert.deepEqual(
      await readFile(path.join(interactionDirectory, "files", "001.jpg")),
      JPEG_BYTES,
    );
    await assert.rejects(
      stat(path.join(interactionDirectory, "outside.jpg")),
      /ENOENT/,
    );

    const interaction = await readJson(
      path.join(interactionDirectory, "interaction.json"),
    );
    assert.equal(interaction.schema_version, "ocr-archive.v1");
    assert.equal(interaction.loai_tuong_tac, "OCR_VAT_TU");
    assert.equal(interaction.task_subtype, "pesticide");
    assert.equal(interaction.ocr_status, "SUCCEEDED");
    assert.equal(interaction.http_status, 200);
    assert.equal(interaction.confidence, 0.91);
    assert.equal(interaction.model_name, null);
    assert.equal(interaction.user_confirmed, null);

    const files = interaction.input_files as Array<Record<string, unknown>>;
    assert.equal(files[0]?.original_name, "../../outside.jpg");
    assert.equal(files[0]?.stored_path, "files/001.jpg");
    assert.equal(files[0]?.size_bytes, JPEG_BYTES.length);
    assert.equal(
      files[0]?.sha256,
      createHash("sha256").update(JPEG_BYTES).digest("hex"),
    );
    assert.deepEqual(
      await readJson(path.join(interactionDirectory, "ai-output.json")),
      responseBody,
    );
    assert.deepEqual(
      await readJson(path.join(interactionDirectory, "normalized.json")),
      {
        success: true,
        message: "Extracted",
        data: { product_name: "Test" },
        metadata: { overall_confidence: 0.91 },
      },
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("archive failure and low free space never throw into the OCR pipeline", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "ocr-archive-full-"));
  const archive = new FilesystemOcrArchive({
    enabled: true,
    directory,
    minFreeBytes: 1_024,
    availableBytes: async () => JPEG_BYTES.length,
  });

  try {
    const started = await archive.begin(input());
    assert.deepEqual(started, { status: "failed" });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("failed OCR responses are archived and concurrent requests never overwrite", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "ocr-archive-error-"));
  const now = new Date("2026-09-03T09:00:00.000Z");
  let sequence = 0;
  const archive = new FilesystemOcrArchive({
    enabled: true,
    directory,
    minFreeBytes: 0,
    now: () => now,
    idFactory: () => `interaction-${++sequence}`,
    availableBytes: async () => 10_000_000,
  });

  try {
    const [first, second] = await Promise.all([
      archive.begin(input("first.jpg")),
      archive.begin(input("second.jpg")),
    ]);
    assert.equal(first.status, "pending");
    assert.equal(second.status, "pending");
    if (first.status !== "pending" || second.status !== "pending") return;

    const failedResponse = {
      success: false,
      error: "EXTRACTION_FAILED",
      message: "Could not extract",
    };
    assert.deepEqual(
      await Promise.all([
        archive.complete(first.handle, {
          httpStatus: 422,
          responseBody: failedResponse,
        }),
        archive.complete(second.handle, {
          httpStatus: 200,
          responseBody: {
            success: true,
            data: { response: { success: true } },
          },
        }),
      ]),
      ["saved", "saved"],
    );

    const dayDirectory = path.join(directory, "2026", "09", "03");
    const interactions = await readdir(dayDirectory);
    assert.equal(interactions.length, 2);
    const failedDirectory = interactions.find((name) =>
      name.endsWith("_interaction-1"),
    );
    assert(failedDirectory);
    const interaction = await readJson(
      path.join(dayDirectory, failedDirectory, "interaction.json"),
    );
    assert.equal(interaction.ocr_status, "FAILED");
    assert.equal(interaction.error_code, "EXTRACTION_FAILED");
    assert.equal(interaction.http_status, 422);
    assert.deepEqual(
      await readJson(
        path.join(dayDirectory, failedDirectory, "ai-output.json"),
      ),
      failedResponse,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("stale pending interactions move to incomplete and are never deleted", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "ocr-archive-stale-"));
  const currentTime = new Date("2026-09-03T08:30:00.000Z");
  const archive = new FilesystemOcrArchive({
    enabled: true,
    directory,
    minFreeBytes: 0,
    now: () => currentTime,
    idFactory: () => "stale-interaction",
    availableBytes: async () => 10_000_000,
  });

  try {
    const started = await archive.begin(input());
    assert.equal(started.status, "pending");
    if (started.status !== "pending") return;

    const oldTime = new Date(currentTime.getTime() - 2 * 60 * 60 * 1_000);
    await utimes(started.handle.pendingDirectory, oldTime, oldTime);
    await archive.recoverStalePending();

    const incompleteDirectory = path.join(
      directory,
      "incomplete",
      "stale-interaction",
    );
    assert.deepEqual(await readdir(path.join(incompleteDirectory, "files")), [
      "001.jpg",
    ]);
    const interaction = await readJson(
      path.join(incompleteDirectory, "interaction.json"),
    );
    assert.equal(interaction.ocr_status, "INTERRUPTED");
    assert.equal(interaction.error_code, "PROCESS_INTERRUPTED");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("archive middleware preserves HTTP body/status and reports saved in a header", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "ocr-middleware-"));
  const archive = new FilesystemOcrArchive({
    enabled: true,
    directory,
    minFreeBytes: 0,
    availableBytes: async () => 10_000_000,
  });
  const app = express();
  app.post(
    "/api/example/analyze",
    (request, _response, next) => {
      request.files = [
        {
          fieldname: "images",
          originalname: "example.jpg",
          encoding: "7bit",
          mimetype: "image/jpeg",
          size: JPEG_BYTES.length,
          buffer: JPEG_BYTES,
          destination: "",
          filename: "",
          path: "",
          stream: null as never,
        },
      ];
      next();
    },
    createOcrArchiveMiddleware(
      {
        interactionType: "OCR_CHUNG_TU",
        apiContractVersion: "receipt.v1",
        initialTaskSubtype: () => "unknown",
        finalTaskSubtype: () => "invoice",
      },
      archive,
    ),
    (_request, response) => {
      response
        .status(202)
        .json({ success: true, data: { response: { ok: 1 } } });
    },
  );

  const server = app.listen(0);
  try {
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address();
    assert(address && typeof address === "object");
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/example/analyze?source=test`,
      { method: "POST" },
    );
    assert.equal(response.status, 202);
    assert.equal(response.headers.get("x-ocr-archive-status"), "saved");
    assert.deepEqual(await response.json(), {
      success: true,
      data: { response: { ok: 1 } },
    });

    const days = await readdir(directory, { withFileTypes: true });
    const year = days.find((entry) => /^\d{4}$/.test(entry.name));
    assert(year);
    const month = (await readdir(path.join(directory, year.name)))[0];
    assert(month);
    const day = (await readdir(path.join(directory, year.name, month)))[0];
    assert(day);
    const interactions = await readdir(
      path.join(directory, year.name, month, day),
    );
    assert.equal(interactions.length, 1);
    const interaction = await readJson(
      path.join(
        directory,
        year.name,
        month,
        day,
        interactions[0]!,
        "interaction.json",
      ),
    );
    assert.equal(interaction.task_subtype, "invoice");
    assert.equal(interaction.endpoint, "/api/example/analyze");
    assert.equal(interaction.http_status, 202);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await rm(directory, { recursive: true, force: true });
  }
});

test("archive middleware skips uploads rejected by content validation", async () => {
  let beginCalled = false;
  let nextCalled = false;
  const middleware = createOcrArchiveMiddleware(
    {
      interactionType: "OCR_VAT_TU",
      apiContractVersion: "product.v1",
      initialTaskSubtype: () => "pesticide",
    },
    {
      begin: async () => {
        beginCalled = true;
        return { status: "disabled" };
      },
      complete: async () => "saved",
    },
  );

  await middleware(
    {
      files: [
        {
          buffer: Buffer.from("not-an-image"),
          mimetype: "image/jpeg",
        },
      ],
    } as never,
    {} as never,
    () => {
      nextCalled = true;
    },
  );

  assert.equal(beginCalled, false);
  assert.equal(nextCalled, true);
});
