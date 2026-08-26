# Feature Request: Online Product Information Enrichment

## Background

The current workflow is:

```text
Frontend
  -> Upload image
Backend
  -> Send image to Vision LLM
  -> Extract product information from label
  -> Validate with Zod structured output
  -> Return JSON response to frontend
```

The extracted information is currently based only on the product label image.

We want to add an optional **online search enrichment feature** that retrieves official product information from government databases and combines it with the Vision LLM extraction result.

---

# New API Behavior

A new query parameter should be supported:

```http
POST /api/...
?search=true
```

Behavior:

- `search=false` or omitted:

  - Keep existing behavior unchanged.

- `search=true`:

  - Run the normal Vision LLM extraction workflow.
  - Perform online product lookup.
  - Merge image-extracted information with official database information.
  - Return enriched product data.

---

# Data Sources

## 1. Pesticide Products (Thuốc BVTV)

Search website:

https://danhmuc.thuocbvtv.com

Search endpoint:

```text
https://danhmuc.thuocbvtv.com/thuoc/search?q=<product_name_or_registration_number>
```

### Important

The search result page does NOT contain full product information.

Workflow:

```text
Search Page
    ->
Extract matching product detail URL
    ->
Request detail page
    ->
Extract structured information from detail page
```

The search result HTML and detail page HTML samples will be provided in the HTML sample folder.

---

## 2. Fertilizer Products (Phân Bón)

National Fertilizer Database:

```text
http://113.190.254.147/PhanBon
```

Search by product name:

```text
http://113.190.254.147/PhanBon/en/phanbonchungnhan?TenPhanBon=<product_name>
```

Search by product code:

```text
http://113.190.254.147/PhanBon/en/phanbonchungnhan?MaPhanBon=<product_code>
```

### Important

Unlike the pesticide website:

- Search result directly returns the product detail page.
- No additional detail-page navigation is required.

The HTML sample response will be provided in the HTML sample folder.

---

# Search Strategy

After Vision LLM extraction is completed:

## Pesticide

Attempt searches using:

1. Product name
2. Registration number

Example:

```text
Search(product_name)
Search(registration_number)
```

For each successful result:

```text
Search page
    ->
Find detail URL
    ->
Fetch detail page
    ->
Extract structured fields
```

---

## Fertilizer

Attempt searches using:

1. Product name
2. Registration number (product code)

Example:

```text
Search(product_name)
Search(registration_number)
```

If a valid page is returned:

```text
Fetch page
    ->
Extract structured fields
```

---

# HTML Parsing Requirements

Use Cheerio for parsing.

Do NOT use an LLM to parse HTML.

The HTML structure is relatively stable and deterministic.

Expected approach:

```text
HTML
    ->
Cheerio
    ->
Extract relevant elements
    ->
Convert to normalized JSON
```

The exact selectors should be determined from the provided sample HTML files.

---

# Data Normalization

Create normalized internal models.

Example:

```ts
interface ingredient {
  name: string;
  content: string;
}

interface dosage {
  target_pest: string;
  target_crop: string;
  amount: string;
  pre_harvest_interval: string;
  usage_instructions: string; // cách dùng
}

interface PesticideSearchResult {
  product_name?: string;
  registration_number?: string;
  registrant?: string;
  ingredients?: ingredient[];
  target_pests?: string[];
  target_crops?: string[];
  dosage?: dosage[];
  source_url?: string;
}
```

```ts
interface FertilizerSearchResult {
  product_name?: string;
  registration_number?: string; // mã số phân bón
  registrant?: string;
  ingredients?: ingredient[];
  dosage?: string; // cách dùng, string vì không có cấu trúc rõ ràng như thuốc BVTV
  source_url?: string;
}
```

---

# Information Fusion

After obtaining:

```text
1. Vision LLM extraction result
2. Website search result
```

Use a secondary LLM call to generate the final enriched response.

Input:

```json
{
  "imageExtraction": {},
  "webSearchResults": {}
}
```

Responsibilities of the fusion LLM:

- ensure searched product is matched with the image-extracted product.
- Resolve conflicts.
- Fill missing fields from official database results.
- Preserve confidence from image extraction.
- Generate a unified final structured response.
- Prefer official database information when conflicts exist.

---

# Suggested Workflow

```text
Frontend
    ->
Backend

    ->
Vision LLM

    ->
Structured Output (Zod)

    ->
Detect Product Type

        ->
        Pesticide Search
        OR
        Fertilizer Search

    ->
Cheerio Extraction

    ->
Normalized JSON

    ->
Fusion LLM

    ->
Final Response

    ->
Frontend
```

---

# Error Handling

Search failures must never fail the entire request.

Examples:

- Website unavailable
- Timeout
- Product not found
- HTML structure changed

Expected behavior:

```text
Image extraction succeeds
+
Search fails
=
Return image extraction result only
```

Log search-related errors separately.

---

# Caching (Recommended)

Consider caching search results.

Suggested cache key:

```text
product_name
registration_number
product_code
```

TTL recommendation:

```text
24 hours
```

This reduces repeated requests to government databases.

---

# Rate Limiting (Recommended)

Government databases may not be designed for high traffic.

Implement:

- Request timeout
- Retry with backoff
- Concurrency limits

to avoid overwhelming external services.

---

# Deliverables

Implement:

1. Search service layer
2. Pesticide scraper
3. Fertilizer scraper
4. HTML-to-JSON normalization
5. Fusion LLM integration
6. Optional `search=true` workflow
7. Robust error handling and logging

The existing extraction workflow must remain fully backward compatible.

### Notes

    * Should not search when there is no valid product name or registration number extracted from the image.
    * If both product name and registration number are available, search by registration number first as it is more specific.
    * Incase pesticide product is searched by name and returns multiple results, attempt to match with the image-extracted information (e.g. best-match selection (exact match > normalized match > fuzzy match)) to find the correct product detail page.
    * Implement with provider-agnostic design (pesticideProvider, fertilizerProvider) to allow future extension to other data sources or product types.
