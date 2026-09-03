import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import express from "express";
import { createAdminRoutes } from "../src/modules/admin/admin.routes.js";
import { OcrHistoryService } from "../src/modules/admin/ocrHistory.service.js";
import { errorHandler } from "../src/shared/errors/error.middleware.js";

const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43]);

interface InteractionOptions {
  id: string;
  createdAt: string;
  status?: "SUCCEEDED" | "FAILED" | "INTERRUPTED" | "PROCESSING";
  interactionType?: "OCR_VAT_TU" | "OCR_CHUNG_TU" | "OCR_GIAY_VUNG_TRONG";
  subtype?: string;
  originalName?: string;
}

async function writeInteraction(
  root: string,
  relativeDirectory: string,
  options: InteractionOptions,
): Promise<string> {
  const directory = path.join(root, relativeDirectory);
  await mkdir(path.join(directory, "files"), { recursive: true });
  await writeFile(path.join(directory, "files", "001.jpg"), JPEG_BYTES);
  await writeFile(
    path.join(directory, "interaction.json"),
    JSON.stringify({
      schema_version: "ocr-archive.v1",
      id: options.id,
      created_at: options.createdAt,
      completed_at: options.createdAt,
      loai_tuong_tac: options.interactionType ?? "OCR_VAT_TU",
      task_subtype: options.subtype ?? "pesticide",
      endpoint: "/api/image/analyze",
      ocr_status: options.status ?? "SUCCEEDED",
      http_status: options.status === "FAILED" ? 422 : 200,
      confidence: 0.91,
      error_code: options.status === "FAILED" ? "EXTRACTION_FAILED" : null,
      input_files: [
        {
          original_name: options.originalName ?? "label.jpg",
          mime_type: "image/jpeg",
          size_bytes: JPEG_BYTES.length,
          sha256: "test-hash",
          stored_path: "files/001.jpg",
        },
      ],
    }),
  );
  await writeFile(
    path.join(directory, "normalized.json"),
    JSON.stringify({ success: true, data: { product_name: options.id } }),
  );
  await writeFile(
    path.join(directory, "ai-output.json"),
    JSON.stringify({ success: true, data: { response: { raw: options.id } } }),
  );
  return directory;
}

async function createServer(root: string): Promise<{
  origin: string;
  close: () => Promise<void>;
}> {
  const app = express();
  app.use(express.json());
  app.use("/api/admin", createAdminRoutes(new OcrHistoryService(root)));
  app.use(errorHandler);
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert(address && typeof address === "object");
  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
}

test("history service lists archive and incomplete records while skipping pending and trash", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ocr-history-admin-"));
  const service = new OcrHistoryService(root);
  try {
    await writeInteraction(root, "2026/09/03/first", {
      id: "first-id",
      createdAt: "2026-09-03T08:30:00.000Z",
      originalName: "alpha-label.jpg",
    });
    await writeInteraction(root, "2026/09/03/second", {
      id: "second-id",
      createdAt: "2026-09-03T09:30:00.000Z",
      status: "FAILED",
      interactionType: "OCR_CHUNG_TU",
      subtype: "invoice",
    });
    await writeInteraction(root, "incomplete/interrupted-id", {
      id: "interrupted-id",
      createdAt: "2026-09-03T10:30:00.000Z",
      status: "INTERRUPTED",
      interactionType: "OCR_GIAY_VUNG_TRONG",
    });
    await writeInteraction(root, "2026/09/03/processing", {
      id: "processing-id",
      createdAt: "2026-09-03T11:30:00.000Z",
      status: "PROCESSING",
    });
    await mkdir(path.join(root, ".pending", "live-request"), { recursive: true });
    await mkdir(path.join(root, ".trash", "old-request"), { recursive: true });
    await mkdir(path.join(root, "2026", "09", "03", "broken"), {
      recursive: true,
    });
    await writeFile(
      path.join(root, "2026", "09", "03", "broken", "interaction.json"),
      "not valid json",
    );

    const all = await service.list({ page: 1, pageSize: 20 });
    assert.equal(all.total, 4);
    assert.deepEqual(
      all.items.map((item) => item.id),
      ["interrupted-id", "second-id", "first-id", "broken"],
    );
    assert.equal(all.items[3]?.ocr_status, "UNKNOWN");
    assert.equal(all.items[3]?.parse_warning, "Không đọc được interaction.json");

    const searched = await service.list({
      page: 1,
      pageSize: 20,
      query: "alpha-label",
    });
    assert.deepEqual(searched.items.map((item) => item.id), ["first-id"]);

    const filtered = await service.list({
      page: 1,
      pageSize: 1,
      status: "FAILED",
      interactionType: "OCR_CHUNG_TU",
      taskSubtype: "invoice",
    });
    assert.equal(filtered.total, 1);
    assert.equal(filtered.items[0]?.id, "second-id");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("admin history routes return detail, stream files and move selected directories to trash", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ocr-history-admin-routes-"));
  try {
    await writeInteraction(root, "2026/09/03/one", {
      id: "route-one",
      createdAt: "2026-09-03T08:30:00.000Z",
    });
    await writeInteraction(root, "2026/09/03/two", {
      id: "route-two",
      createdAt: "2026-09-03T09:30:00.000Z",
    });
    const server = await createServer(root);
    try {
      const listResponse = await fetch(`${server.origin}/api/admin/ocr-history?page=1&page_size=1`);
      assert.equal(listResponse.status, 200);
      const list = (await listResponse.json()) as {
        success: boolean;
        data: { total: number; items: Array<{ id: string }> };
      };
      assert.equal(list.success, true);
      assert.equal(list.data.total, 2);
      assert.deepEqual(list.data.items.map((item) => item.id), ["route-two"]);

      const detailResponse = await fetch(`${server.origin}/api/admin/ocr-history/route-one`);
      const detail = (await detailResponse.json()) as {
        data: { normalized_output: { data: { product_name: string } } };
      };
      assert.equal(detailResponse.status, 200);
      assert.equal(detail.data.normalized_output.data.product_name, "route-one");

      const invalidReviewResponse = await fetch(
        `${server.origin}/api/admin/ocr-history/route-one/review`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_confirmed: false, user_correction: "" }),
        },
      );
      assert.equal(invalidReviewResponse.status, 400);

      const reviewResponse = await fetch(
        `${server.origin}/api/admin/ocr-history/route-one/review`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_confirmed: false,
            user_correction: "Sai số đăng ký sản phẩm",
          }),
        },
      );
      const reviewed = (await reviewResponse.json()) as {
        data: { user_confirmed: boolean; user_correction: string; reviewed_at: string };
      };
      assert.equal(reviewResponse.status, 200);
      assert.equal(reviewed.data.user_confirmed, false);
      assert.equal(reviewed.data.user_correction, "Sai số đăng ký sản phẩm");
      assert.match(reviewed.data.reviewed_at, /^2026|^20\d{2}/);

      const fileResponse = await fetch(`${server.origin}/api/admin/ocr-history/route-one/files/0?download=true`);
      assert.equal(fileResponse.status, 200);
      assert.match(fileResponse.headers.get("content-disposition") ?? "", /^attachment/);
      assert.deepEqual(Buffer.from(await fileResponse.arrayBuffer()), JPEG_BYTES);

      const invalidFileResponse = await fetch(`${server.origin}/api/admin/ocr-history/route-one/files/-1`);
      assert.equal(invalidFileResponse.status, 400);
      const invalidIdResponse = await fetch(`${server.origin}/api/admin/ocr-history/bad%24id`);
      assert.equal(invalidIdResponse.status, 400);

      const deletedResponse = await fetch(`${server.origin}/api/admin/ocr-history/route-one`, {
        method: "DELETE",
      });
      assert.equal(deletedResponse.status, 200);
      await assert.rejects(readFile(path.join(root, "2026", "09", "03", "one")));

      const bulkResponse = await fetch(`${server.origin}/api/admin/ocr-history/bulk-delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: ["route-two", "missing-id"] }),
      });
      const bulk = (await bulkResponse.json()) as {
        data: { moved_ids: string[]; failed: Array<{ id: string; reason: string }> };
      };
      assert.equal(bulkResponse.status, 200);
      assert.deepEqual(bulk.data.moved_ids, ["route-two"]);
      assert.deepEqual(bulk.data.failed, [{ id: "missing-id", reason: "not_found" }]);
      assert.equal((await readdir(path.join(root, ".trash"))).length, 2);
    } finally {
      await server.close();
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
