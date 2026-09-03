import { z } from "zod";

const NullableText = z.string().min(1).nullable();

const IsoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable();

const BoundaryPointSchema = z
  .object({
    point_label: NullableText,
    latitude: z.number().min(-90).max(90).nullable(),
    longitude: z.number().min(-180).max(180).nullable(),
  })
  .strict();

const GrowingAreaAddressSchema = z
  .object({
    house_number: NullableText,
    street_name: NullableText,
    neighborhood: NullableText,
    hamlet_or_equivalent: NullableText,
    commune_code: NullableText,
    commune_name: NullableText,
    former_district_code: NullableText,
    former_district_name: NullableText,
    province_code: NullableText,
    province_name: NullableText,
    full_display_address: NullableText,
    address_notes: NullableText,
  })
  .strict();

/** Fields extracted by the model. Uploaded-file metadata is added by the server. */
export const GrowingAreaCertificateExtractedDataSchema = z
  .object({
    certificate_number: NullableText,
    issue_date: IsoDate,
    expiry_date: IsoDate,
    issuing_authority: NullableText,
    scope_note: NullableText,
    certified_production: z.number().nonnegative().nullable(),
    certified_production_unit: NullableText,
    growing_area_management_unit: NullableText,
    growing_area_code: NullableText,
    growing_area_name: NullableText,
    total_area_ha: z.number().nonnegative().nullable(),
    overall_boundary: z.array(BoundaryPointSchema),
    growing_area_administrative_address: NullableText,
    note: NullableText,
    address: GrowingAreaAddressSchema,
  })
  .strict();

const UploadedFileSchema = z
  .object({
    file_name: z.string().min(1),
    mime_type: z.string().min(1),
    size_bytes: z.number().int().nonnegative(),
  })
  .strict();

export const GrowingAreaCertificateDataSchema =
  GrowingAreaCertificateExtractedDataSchema.extend({
    certificate_files: z.array(UploadedFileSchema),
    growing_area_images: z.array(UploadedFileSchema),
  }).strict();

export const GrowingAreaCertificateReviewWarningCodeSchema = z.enum([
  "LOW_IMAGE_QUALITY",
  "BLUR",
  "GLARE",
  "CROPPED_DOCUMENT",
  "ROTATED_INPUT",
  "MISSING_PAGE",
  "PAGE_ORDER_UNCERTAIN",
  "DUPLICATE_PAGE",
  "UNREADABLE_FIELD",
  "AMBIGUOUS_FIELD",
  "NUMERIC_FORMAT_AMBIGUOUS",
  "COORDINATE_UNREADABLE",
  "TEXT_LAYER_VISUAL_MISMATCH",
]);

export const GrowingAreaCertificateReviewWarningSchema = z
  .object({
    code: GrowingAreaCertificateReviewWarningCodeSchema,
    field_path: z.string().min(1).nullable(),
    page_index: z.number().int().positive().nullable(),
    message: z.string().min(1),
  })
  .strict();

const PageMetadataSchema = z
  .object({
    input_index: z.number().int().positive(),
    printed_page_number: z.number().int().positive().nullable(),
    role: z.enum(["main", "continuation", "unknown"]),
    usable: z.boolean(),
  })
  .strict();

export const GrowingAreaCertificateMetadataSchema = z
  .object({
    schema_version: z.literal("growing-area-certificate.v2"),
    document_type: z.enum(["growing_area_code_certificate", "unknown"]),
    page_count_received: z.number().int().nonnegative(),
    document_count_detected: z.number().int().nonnegative(),
    pages: z.array(PageMetadataSchema),
    review_required: z.boolean(),
    review_warnings: z.array(GrowingAreaCertificateReviewWarningSchema),
  })
  .strict();

export const GrowingAreaCertificateFatalErrorCodeSchema = z.enum([
  "NO_DOCUMENT_DETECTED",
  "WRONG_DOCUMENT_TYPE",
  "MULTIPLE_DOCUMENTS_DETECTED",
  "PAGE_SET_MISMATCH",
  "UNREADABLE_DOCUMENT",
  "EXTRACTION_FAILED",
  "SCHEMA_VALIDATION_FAILED",
]);

const ModelSuccessResponseSchema = z
  .object({
    success: z.literal(true),
    error_code: z.null(),
    message: z.string(),
    data: GrowingAreaCertificateExtractedDataSchema,
    metadata: GrowingAreaCertificateMetadataSchema,
  })
  .strict();

const ContractSuccessResponseSchema = ModelSuccessResponseSchema.extend({
  data: GrowingAreaCertificateDataSchema,
}).strict();

const ErrorResponseSchema = z
  .object({
    success: z.literal(false),
    error_code: GrowingAreaCertificateFatalErrorCodeSchema,
    message: z.string(),
    data: z.null(),
    metadata: GrowingAreaCertificateMetadataSchema,
  })
  .strict();

/** Root object required by the OpenAI-compatible structured-output endpoint. */
export const GrowingAreaCertificateResponseSchema = z
  .object({
    success: z.boolean(),
    error_code: z.union([z.null(), GrowingAreaCertificateFatalErrorCodeSchema]),
    message: z.string(),
    data: GrowingAreaCertificateExtractedDataSchema.nullable(),
    metadata: GrowingAreaCertificateMetadataSchema,
  })
  .strict();

export const GrowingAreaCertificateResponseContractSchema =
  z.discriminatedUnion("success", [
    ContractSuccessResponseSchema,
    ErrorResponseSchema,
  ]);

export type GrowingAreaCertificateResponse = z.infer<
  typeof GrowingAreaCertificateResponseContractSchema
>;
