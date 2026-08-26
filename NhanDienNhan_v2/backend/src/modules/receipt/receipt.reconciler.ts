import type { z } from "zod";
import { DocumentResponseSchema } from "./receipt.schema";

/**
 * Helper to reconcile document values and automatically add warnings in case of mathematical mismatches.
 * Handles both "invoice" (financial details) and "delivery_note" (weight and bag quantity details).
 */

type DocumentResponse = z.infer<typeof DocumentResponseSchema>;
type ReviewWarning = NonNullable<
  DocumentResponse["metadata"]
>["review_warnings"][number];
type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNumber(value: unknown): value is number {
  return typeof value === "number";
}

function getItems(document: RecordValue): RecordValue[] {
  return Array.isArray(document.items) ? document.items.filter(isRecord) : [];
}

function createWarning(field: string, message: string): ReviewWarning {
  return { field, issue: "MATH_MISMATCH", message };
}

export function reconcileDocumentMath(response: unknown): unknown {
  if (
    !isRecord(response) ||
    response.success !== true ||
    !isRecord(response.data)
  ) {
    return response;
  }

  const documents = response.data.documents;
  if (!Array.isArray(documents)) {
    return response;
  }

  const originalMetadata = response.metadata;
  const metadata = isRecord(originalMetadata)
    ? {
        ...originalMetadata,
        review_warnings: Array.isArray(originalMetadata.review_warnings)
          ? [...originalMetadata.review_warnings]
          : [],
      }
    : { overall_confidence: 1.0, review_warnings: [] as unknown[] };
  const warnings = metadata.review_warnings;

  documents.forEach((document, docIndex) => {
    if (!isRecord(document) || typeof document.document_type !== "string") {
      return;
    }

    const items = getItems(document);

    if (document.document_type === "invoice") {
      let calculatedGrandTotal = 0;
      let hasValidItems = false;

      items.forEach((item, itemIndex) => {
        const quantity = item.quantity;
        const unitPrice = item.unit_price;
        const totalAmount = item.total_amount;

        if (isNumber(quantity) && isNumber(unitPrice)) {
          const expectedTotal = quantity * unitPrice;
          if (
            isNumber(totalAmount) &&
            Math.abs(expectedTotal - totalAmount) > 0.01
          ) {
            warnings.push(
              createWarning(
                `documents.${docIndex}.items.${itemIndex}.quantity`,
                `Há»‡ thá»‘ng tá»± Ä‘á»™ng phÃ¡t hiá»‡n á»Ÿ chá»©ng tá»« sá»‘ ${docIndex + 1}: dÃ²ng sá»‘ ${itemIndex + 1} cÃ³ sá»‘ lÆ°á»£ng ${quantity} x Ä‘Æ¡n giÃ¡ ${unitPrice} (= ${expectedTotal}) khÃ´ng khá»›p vá»›i thÃ nh tiá»n ${totalAmount}`,
              ),
            );
          }
        }

        if (isNumber(totalAmount)) {
          calculatedGrandTotal += totalAmount;
          hasValidItems = true;
        }
      });

      const grandTotal = document.grand_total;
      if (
        hasValidItems &&
        isNumber(grandTotal) &&
        Math.abs(calculatedGrandTotal - grandTotal) > 0.01
      ) {
        warnings.push(
          createWarning(
            `documents.${docIndex}.grand_total`,
            `Há»‡ thá»‘ng tá»± Ä‘á»™ng phÃ¡t hiá»‡n á»Ÿ chá»©ng tá»« sá»‘ ${docIndex + 1}: tá»•ng thÃ nh tiá»n cá»§a cÃ¡c dÃ²ng (= ${calculatedGrandTotal}) khÃ´ng khá»›p vá»›i tá»•ng tiá»n thanh toÃ¡n ${grandTotal}`,
          ),
        );
      }
    } else if (document.document_type === "delivery_note") {
      let calculatedTotalBags = 0;
      let calculatedTotalWeight = 0;
      let hasValidBags = false;
      let hasValidWeight = false;

      items.forEach((item, itemIndex) => {
        const netContent = item.net_content;
        const bagCount = item.bag_count;
        const totalWeight = item.total_weight;

        if (isNumber(netContent) && isNumber(bagCount)) {
          const expectedWeight = netContent * bagCount;
          if (
            isNumber(totalWeight) &&
            Math.abs(expectedWeight - totalWeight) > 0.01
          ) {
            warnings.push(
              createWarning(
                `documents.${docIndex}.items.${itemIndex}.total_weight`,
                `Há»‡ thá»‘ng tá»± Ä‘á»™ng phÃ¡t hiá»‡n á»Ÿ chá»©ng tá»« sá»‘ ${docIndex + 1}: dÃ²ng sá»‘ ${itemIndex + 1} cÃ³ khá»‘i lÆ°á»£ng 1 bao ${netContent} x sá»‘ bao ${bagCount} (= ${expectedWeight}) khÃ´ng khá»›p vá»›i tá»•ng khá»‘i lÆ°á»£ng dÃ²ng ${totalWeight}`,
              ),
            );
          }
        }

        if (isNumber(bagCount)) {
          calculatedTotalBags += bagCount;
          hasValidBags = true;
        }

        if (isNumber(totalWeight)) {
          calculatedTotalWeight += totalWeight;
          hasValidWeight = true;
        }
      });

      const totalBags = document.total_bags;
      if (
        hasValidBags &&
        isNumber(totalBags) &&
        calculatedTotalBags !== totalBags
      ) {
        warnings.push(
          createWarning(
            `documents.${docIndex}.total_bags`,
            `Há»‡ thá»‘ng tá»± Ä‘á»™ng phÃ¡t hiá»‡n á»Ÿ chá»©ng tá»« sá»‘ ${docIndex + 1}: tá»•ng sá»‘ bao cÃ¡c dÃ²ng (= ${calculatedTotalBags}) khÃ´ng khá»›p vá»›i tá»•ng sá»‘ bao cá»§a phiáº¿u ${totalBags}`,
          ),
        );
      }

      const totalWeightKg = document.total_weight_kg;
      if (
        hasValidWeight &&
        isNumber(totalWeightKg) &&
        Math.abs(calculatedTotalWeight - totalWeightKg) > 0.01
      ) {
        warnings.push(
          createWarning(
            `documents.${docIndex}.total_weight_kg`,
            `Há»‡ thá»‘ng tá»± Ä‘á»™ng phÃ¡t hiá»‡n á»Ÿ chá»©ng tá»« sá»‘ ${docIndex + 1}: tá»•ng khá»‘i lÆ°á»£ng cÃ¡c dÃ²ng (= ${calculatedTotalWeight}) khÃ´ng khá»›p vá»›i tá»•ng khá»‘i lÆ°á»£ng cá»§a phiáº¿u ${totalWeightKg}`,
          ),
        );
      }
    }
  });

  return {
    ...response,
    metadata,
    data: {
      ...response.data,
      documents: [...documents],
    },
  };
}
