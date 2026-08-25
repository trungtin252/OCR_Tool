export type CanonicalImageMime =
  | "image/jpeg"
  | "image/png"
  | "image/gif"
  | "image/webp";

const IMAGE_MIME_ALIASES: Readonly<Record<string, CanonicalImageMime>> = {
  "image/jpeg": "image/jpeg",
  "image/jpg": "image/jpeg",
  "image/png": "image/png",
  "image/gif": "image/gif",
  "image/webp": "image/webp",
};

export function getCanonicalImageMime(
  mimeType: string,
): CanonicalImageMime | null {
  return IMAGE_MIME_ALIASES[mimeType.toLowerCase()] ?? null;
}

export function isSupportedUploadMime(
  mimeType: string,
  allowPdf: boolean,
): boolean {
  return (
    getCanonicalImageMime(mimeType) !== null ||
    (allowPdf && mimeType.toLowerCase() === "application/pdf")
  );
}

function startsWithBytes(
  buffer: Buffer,
  signature: readonly number[],
): boolean {
  if (buffer.length < signature.length) return false;
  return signature.every((byte, index) => buffer[index] === byte);
}

/**
 * MIME values in multipart requests are supplied by the caller. Verify the
 * corresponding magic bytes before sending the payload to a parser or LLM.
 */
export function hasExpectedFileSignature(
  buffer: Buffer,
  mimeType: string,
): boolean {
  const canonicalMime = getCanonicalImageMime(mimeType);

  switch (canonicalMime) {
    case "image/jpeg":
      return startsWithBytes(buffer, [0xff, 0xd8, 0xff]);
    case "image/png":
      return startsWithBytes(
        buffer,
        [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
      );
    case "image/gif": {
      const header = buffer.subarray(0, 6).toString("ascii");
      return header === "GIF87a" || header === "GIF89a";
    }
    case "image/webp":
      return (
        buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
        buffer.subarray(8, 12).toString("ascii") === "WEBP"
      );
    default:
      return mimeType.toLowerCase() === "application/pdf"
        ? buffer.subarray(0, 5).toString("ascii") === "%PDF-"
        : false;
  }
}
