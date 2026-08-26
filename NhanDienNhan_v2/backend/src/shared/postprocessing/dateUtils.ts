/**
 * Formats various date string formats to standard dd/mm/yyyy format
 * Supports formats like: dd/mm/yy, dd mm yy, dd/mm/yyyy, dd mm yyyy, dd.mm.yy, dd.mm.yyyy, etc.
 * @param dateStr - Input date string
 * @returns Formatted date string in dd/mm/yyyy format, or empty string if invalid
 */
export function formatDateString(dateStr: string): string {
  if (!dateStr || typeof dateStr !== "string") {
    return "";
  }

  // Trim and normalize whitespace and separators (/, ., -)
  const normalized = dateStr.trim().replace(/[\s.\/-]+/g, " ");

  // Try to extract numbers from the string
  const numbers = normalized.match(/\d+/g);

  if (!numbers || numbers.length < 3) {
    return "";
  }

  let day = parseInt(numbers[0]!);
  let month = parseInt(numbers[1]!);
  let year = parseInt(numbers[2]!);

  // Handle 2-digit year (yy format)
  if (year < 100) {
    // Assume years 00-40 are 2000s, 41-99 are 1900s
    year = year <= 40 ? 2000 + year : 1900 + year;
  }

  if (!isValidCalendarDate(day, month, year)) {
    return "";
  }

  // Format as dd/mm/yyyy
  const dayStr = String(day).padStart(2, "0");
  const monthStr = String(month).padStart(2, "0");

  return `${dayStr}/${monthStr}/${year}`;
}

function isValidCalendarDate(
  day: number,
  month: number,
  year: number,
): boolean {
  if (
    !Number.isInteger(day) ||
    !Number.isInteger(month) ||
    !Number.isInteger(year) ||
    year < 1900 ||
    year > 2100
  ) {
    return false;
  }

  const candidate = new Date(Date.UTC(year, month - 1, day));
  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  );
}

/**
 * Parses Vietnamese shelf life format and returns duration in months
 * Supports formats like:
 * - "18 tháng" (18 months)
 * - "2 năm" (2 years)
 * - "18 tháng kể từ ngày sản xuất"
 * - "2 năm kể từ ngày sản xuất"
 * - "18 months", "2 years", etc.
 * @param shelfLifeStr - Shelf life string in Vietnamese or English
 * @returns Duration in months, or 0 if invalid
 */
export function parseShelfLife(shelfLifeStr: string): number {
  if (!shelfLifeStr || typeof shelfLifeStr !== "string") {
    return 0;
  }

  const normalized = shelfLifeStr.toLowerCase().trim();

  // Extract the number
  const numberMatch = normalized.match(/(\d+)\s*(\.)?(\d+)?/);
  if (!numberMatch) {
    return 0;
  }

  let value = parseFloat(numberMatch[0]);

  // Check for years (năm, year, years)
  if (/(năm|year|years)/.test(normalized)) {
    return Math.round(value * 12);
  }

  // Check for months (tháng, month, months)
  if (/(tháng|month|months)/.test(normalized)) {
    return Math.round(value);
  }

  // Check for days (ngày, day, days)
  if (/(ngày|day|days)/.test(normalized)) {
    return Math.round(value / 30); // Approximate
  }

  // Check for weeks (tuần, week, weeks)
  if (/(tuần|week|weeks)/.test(normalized)) {
    return Math.round((value * 7) / 30); // Approximate
  }

  return 0;
}

/**
 * Calculates expiry date based on manufacturing date and shelf life
 * @param manufacturingDateStr - Manufacturing date in dd/mm/yyyy format
 * @param shelfLifeStr - Shelf life in Vietnamese format (e.g., "18 tháng", "2 năm")
 * @returns Expiry date in dd/mm/yyyy format, or empty string if invalid
 */
export function calculateExpiryDate(
  manufacturingDateStr: string,
  shelfLifeStr: string,
): string {
  // Parse manufacturing date
  if (!manufacturingDateStr || typeof manufacturingDateStr !== "string") {
    return "";
  }

  const dateParts = manufacturingDateStr.split("/");
  if (dateParts.length !== 3) {
    return "";
  }

  const day = parseInt(dateParts[0]!);
  const month = parseInt(dateParts[1]!);
  const year = parseInt(dateParts[2]!);

  if (!isValidCalendarDate(day, month, year)) {
    return "";
  }

  // Parse shelf life to get months
  const shelfLifeMonths = parseShelfLife(shelfLifeStr);
  if (shelfLifeMonths <= 0) {
    return "";
  }

  // Clamp to the last valid day of the target month instead of allowing
  // JavaScript Date to roll an end-of-month value into the following month.
  const rawTargetMonth = month - 1 + shelfLifeMonths;
  const targetYear = year + Math.floor(rawTargetMonth / 12);
  const targetMonth = rawTargetMonth % 12;
  const lastDayOfTargetMonth = new Date(
    targetYear,
    targetMonth + 1,
    0,
  ).getDate();
  const expiryDate = new Date(
    targetYear,
    targetMonth,
    Math.min(day, lastDayOfTargetMonth),
  );

  // Format as dd/mm/yyyy
  const expiryDay = String(expiryDate.getDate()).padStart(2, "0");
  const expiryMonth = String(expiryDate.getMonth() + 1).padStart(2, "0");
  const expiryYear = expiryDate.getFullYear();

  return `${expiryDay}/${expiryMonth}/${expiryYear}`;
}

/**
 * Alias for calculateExpiryDate with reversed parameter order
 * @param shelfLifeStr - Shelf life in Vietnamese format
 * @param manufacturingDateStr - Manufacturing date in dd/mm/yyyy format
 * @returns Expiry date in dd/mm/yyyy format
 */
export function calculateExpiryDateFromShelfLife(
  shelfLifeStr: string,
  manufacturingDateStr: string,
): string {
  return calculateExpiryDate(manufacturingDateStr, shelfLifeStr);
}
