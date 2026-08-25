import express, { Request, Response, NextFunction } from "express";
import multer from "multer";
import {
  processImagesWithOpenAI_chatCompletions,
  processImagesTest,
} from "../services/analyze/imageProcessor.js";
import { buildPrompt, test_prompt } from "../utils/prompts/productPrompts.js";
import { enrichWithSearch } from "../services/search/index.js";
import {
  parseBooleanQuery,
  parseProductSchemaType,
  parseSearchMode,
} from "../utils/requestValidation.js";
import {
  getCanonicalImageMime,
  hasExpectedFileSignature,
  isSupportedUploadMime,
} from "../utils/uploadValidation.js";

const router = express.Router();

// Configure multer for in-memory file storage
const storage = multer.memoryStorage();

// Single upload handler for 1-10 images
const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    console.log("File field name:", file.fieldname, "MIME:", file.mimetype);
    // Only accept image formats supported by the LLM data URL mapper.
    if (isSupportedUploadMime(file.mimetype, false)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, GIF, and WebP images are allowed"));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 10,
    fields: 10,
    parts: 20,
  },
});

// Custom error handler for multer
const handleMulterError = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  console.error("Multer error details:", {
    name: err.name,
    message: err.message,
    code: err.code,
    field: err.field,
  });

  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        error: "File size exceeds 10MB limit",
        message: "File size exceeds 10MB limit",
      });
    }
    return res.status(400).json({
      success: false,
      error: err.message || "File upload error",
      message: err.message || "File upload error",
    });
  }

  if (err) {
    return res.status(400).json({
      success: false,
      error: err.message || "File upload failed",
      message: err.message || "File upload failed",
    });
  }

  next();
};

function sendBadRequest(res: Response, error: string) {
  return res.status(400).json({
    success: false,
    error,
    message: error,
  });
}

function requireTestEndpointsEnabled(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (process.env.ENABLE_TEST_ENDPOINTS === "false") {
    return res.status(404).json({
      success: false,
      message: "Route not found",
    });
  }
  next();
}

// POST endpoint for default image analysis (accepts 1-10 images)
router.post("/analyze", (req: Request, res: Response, next: NextFunction) => {
  upload.array("images", 10)(req, res, (err) => {
    if (err) {
      return handleMulterError(err, req, res, next);
    }
    next();
  });
});

router.post(
  "/analyze",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check if files were uploaded
      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          error:
            "No image files provided. Make sure to send files with field name 'images'",
          message:
            "No image files provided. Make sure to send files with field name 'images'",
        });
      }
      const schemaType = parseProductSchemaType(req.query.category);
      if (!schemaType) {
        return sendBadRequest(
          res,
          "Invalid category. Supported values: pesticide, fertilizer, fish_feed, seed",
        );
      }

      const isParsed = parseBooleanQuery(req.query.parsed);
      const formatDates = parseBooleanQuery(req.query.formatDates);

      // ── Search mode ──────────────────────────────────────────────
      const searchMode = parseSearchMode(req.query.searchMode);
      // ─────────────────────────────────────────────────────────────

      console.log(
        "Processing images for category:",
        schemaType,
        "formatDates:",
        formatDates,
        "searchMode:",
        searchMode,
      );

      const files = req.files as Express.Multer.File[];

      const invalidFile = files.find(
        (file) => !hasExpectedFileSignature(file.buffer, file.mimetype),
      );
      if (invalidFile) {
        return sendBadRequest(
          res,
          `File '${invalidFile.originalname}' content does not match a supported image format`,
        );
      }

      console.log("Files received:", files.length);

      // buildPrompt selects the correct base prompt and embeds the search
      // decision instructions when interactive search mode is active
      const prompt = buildPrompt(schemaType, searchMode === "interactive");

      const imageBuffers = files.map((file) => file.buffer);
      const imageTypes = files.map(
        (file) => getCanonicalImageMime(file.mimetype)!,
      );

      const result = await processImagesWithOpenAI_chatCompletions(
        imageBuffers,
        imageTypes,
        prompt,
        schemaType,
        isParsed,
        formatDates,
        /* withSearchSchema */ searchMode === "interactive",
      );

      // ── Online search enrichment ──────────────────────────────────
      // searchMode === always     → always enrich (if category supports it)
      // searchMode === interactive → hybrid gate: enrich if LLM says so OR
      //                             if critical fields are missing
      const RETURN_BOTH_RAW_AND_ENRICHED = true;
      let responseData = result.response;
      let searchMetadata: object | undefined;

      const isSearchableCategory =
        schemaType === "pesticide" || schemaType === "fertilizer";

      let shouldEnrich = false;
      let searchDecision:
        | { needs_web_search: boolean; search_reason: string | null }
        | undefined;

      if (isSearchableCategory) {
        if (searchMode === "always") {
          shouldEnrich = true;
        } else if (searchMode === "interactive") {
          // Parse the extraction result to inspect fields and LLM decision
          const extractionObj: any =
            typeof responseData === "string"
              ? JSON.parse(responseData)
              : responseData;

          searchDecision = extractionObj?.search_decision ?? undefined;
          const data = extractionObj?.data;

          const llmWantsSearch = searchDecision?.needs_web_search === true;
          const missingIngredients =
            !data?.ingredients || data.ingredients.length === 0;
          const missingInterval = data?.pre_harvest_interval_days == null;

          shouldEnrich =
            llmWantsSearch || missingIngredients || missingInterval;
          console.log("Interactive search gate:", {
            llmWantsSearch,
            missingIngredients,
            missingInterval,
            shouldEnrich,
          });
        }
      }

      if (shouldEnrich) {
        // Ensure we have a parsed object to work with
        const extractionObject: object =
          typeof responseData === "string"
            ? (JSON.parse(responseData) as object)
            : (responseData as object);

        const enrichment = await enrichWithSearch(
          extractionObject,
          schemaType as "pesticide" | "fertilizer",
        );
        searchMetadata = enrichment.searchMetadata;

        // Re-serialize to match the original isParsed contract
        responseData = isParsed
          ? enrichment.enrichedResult
          : JSON.stringify(enrichment.enrichedResult);
      }
      // ─────────────────────────────────────────────────────────────

      return res.status(200).json({
        success: true,
        data: {
          response: responseData,
          ...(RETURN_BOTH_RAW_AND_ENRICHED && shouldEnrich
            ? { raw: result.response }
            : {}),
          totalImages: files.length,
          ...(searchMetadata ? { search_metadata: searchMetadata } : {}),
          // Expose the LLM's search decision for debugging (interactive searchMode only)
          ...(searchMode === "interactive" && searchDecision !== undefined
            ? { search_decision: searchDecision }
            : {}),
        },
      });
    } catch (error: any) {
      console.error("Image analysis error:", error);
      error.message = error.message || "Failed to analyze images";
      next(error);
    }
  },
);

// POST endpoint for testing with custom prompt
router.post(
  "/test",
  requireTestEndpointsEnabled,
  (req: Request, res: Response, next: NextFunction) => {
    upload.array("images", 10)(req, res, (err) => {
      if (err) {
        return handleMulterError(err, req, res, next);
      }
      next();
    });
  },
);

router.post("/test", async (req: Request, res: Response) => {
  try {
    // Check if files were uploaded
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error:
          "No image files provided. Make sure to send files with field name 'images'",
        message:
          "No image files provided. Make sure to send files with field name 'images'",
      });
    }
    const schemaType = "";
    console.log("Processing images for category:", schemaType);

    const files = req.files as Express.Multer.File[];

    const invalidFile = files.find(
      (file) => !hasExpectedFileSignature(file.buffer, file.mimetype),
    );
    if (invalidFile) {
      return sendBadRequest(
        res,
        `File '${invalidFile.originalname}' content does not match a supported image format`,
      );
    }

    console.log("Files received:", files.length);

    const prompt = test_prompt;
    const imageBuffers = files.map((file) => file.buffer);
    const imageTypes = files.map(
      (file) => getCanonicalImageMime(file.mimetype)!,
    );

    const result = await processImagesTest(
      imageBuffers,
      imageTypes,
      prompt,
      schemaType,
    );

    return res.status(200).json({
      success: true,
      data: {
        response: result.response,
        totalImages: files.length,
      },
    });
  } catch (error: any) {
    console.error("Image analysis error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to analyze images",
    });
  }
});

export default router;
