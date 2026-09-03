import { getApiErrorMessage, getNetworkErrorMessage } from "./apiError";

const API_BASE_URL =
  import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

export type GrowingAreaCertificateWarningCode =
  | "LOW_IMAGE_QUALITY"
  | "BLUR"
  | "GLARE"
  | "CROPPED_DOCUMENT"
  | "ROTATED_INPUT"
  | "MISSING_PAGE"
  | "PAGE_ORDER_UNCERTAIN"
  | "DUPLICATE_PAGE"
  | "UNREADABLE_FIELD"
  | "AMBIGUOUS_FIELD"
  | "NUMERIC_FORMAT_AMBIGUOUS"
  | "COORDINATE_UNREADABLE"
  | "TEXT_LAYER_VISUAL_MISMATCH";

export interface GrowingAreaCertificateReviewWarning {
  code: GrowingAreaCertificateWarningCode;
  field_path: string | null;
  page_index: number | null;
  message: string;
}

export interface GrowingAreaBoundaryPoint {
  point_label: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface UploadedFileReference {
  file_name: string;
  mime_type: string;
  size_bytes: number;
}

export interface GrowingAreaAddress {
  house_number: string | null;
  street_name: string | null;
  neighborhood: string | null;
  hamlet_or_equivalent: string | null;
  commune_code: string | null;
  commune_name: string | null;
  former_district_code: string | null;
  former_district_name: string | null;
  province_code: string | null;
  province_name: string | null;
  full_display_address: string | null;
  address_notes: string | null;
}

export interface GrowingAreaCertificateData {
  certificate_number: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  issuing_authority: string | null;
  certificate_files: UploadedFileReference[];
  scope_note: string | null;
  certified_production: number | null;
  certified_production_unit: string | null;
  growing_area_management_unit: string | null;
  growing_area_code: string | null;
  growing_area_name: string | null;
  total_area_ha: number | null;
  overall_boundary: GrowingAreaBoundaryPoint[];
  growing_area_administrative_address: string | null;
  growing_area_images: UploadedFileReference[];
  note: string | null;
  address: GrowingAreaAddress;
}

export interface GrowingAreaCertificateMetadata {
  schema_version: "growing-area-certificate.v2";
  document_type: "growing_area_code_certificate" | "unknown";
  page_count_received: number;
  document_count_detected: number;
  pages: Array<{
    input_index: number;
    printed_page_number: number | null;
    role: "main" | "continuation" | "unknown";
    usable: boolean;
  }>;
  review_required: boolean;
  review_warnings: GrowingAreaCertificateReviewWarning[];
}

export type GrowingAreaCertificateOcrResponse =
  | {
      success: true;
      error_code: null;
      message: string;
      data: GrowingAreaCertificateData;
      metadata: GrowingAreaCertificateMetadata;
    }
  | {
      success: false;
      error_code: string;
      message: string;
      data: null;
      metadata: GrowingAreaCertificateMetadata;
    };

export interface GrowingAreaCertificateApiResponse {
  success: boolean;
  data?: {
    response: GrowingAreaCertificateOcrResponse;
    totalImages: number;
  };
  error?: string;
  message?: string;
}

export async function uploadFilesForGrowingAreaCertificateAnalysis(
  files: File[],
): Promise<GrowingAreaCertificateApiResponse> {
  const formData = new FormData();
  files.forEach((file) => formData.append("images", file));

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/ga_certificate/analyze`,
      {
        method: "POST",
        body: formData,
      },
    );
    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        success: false,
        message: getApiErrorMessage(
          payload,
          `Server error: ${response.status}`,
        ),
      };
    }

    return payload as GrowingAreaCertificateApiResponse;
  } catch (error) {
    return {
      success: false,
      message: getNetworkErrorMessage(
        error,
        "Network error while uploading certificate files",
      ),
    };
  }
}
