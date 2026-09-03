import { useState } from "react";
import { ImageUpload } from "./components/ImageUpload";
import { PesticideResults } from "./components/PesticideResults";
import { FishFeedResults } from "./components/FishFeedResults";
import { FertilizerResults } from "./components/FertilizerResults";
import { SeedResults } from "./components/SeedResults";
import { ReceiptUpload } from "./components/ReceiptUpload";
import { ReceiptResults } from "./components/ReceiptResults";
import { GaCertificateUpload } from "./components/GaCertificateUpload";
import { GaCertificateResults } from "./components/GaCertificateResults";
import type {
  ProductInfo,
  ProductCategory,
  SearchMetadata,
  SearchMode,
} from "./apis/imageApi";
import { LoadingIndicator } from "./components/LoadingIndicator";
import {
  uploadMultipleImagesForAnalysis,
  parseProductInfo,
} from "./apis/imageApi";
import { uploadFilesForReceiptAnalysis } from "./apis/receiptApi";
import type { ReceiptApiResponse } from "./apis/receiptApi";
import {
  uploadFilesForGrowingAreaCertificateAnalysis,
  type GrowingAreaCertificateApiResponse,
} from "./apis/gaCertificateApi";
import { Switch } from "./components/ui/switch";
import "./App.css";

// ─── Types ────────────────────────────────────────────────────────────────────

type AppMode = "product" | "receipt" | "growing_area_certificate";
type ViewState = "upload" | "loading" | "results";

const isSearchableCategory = (cat: ProductCategory) =>
  cat === "pesticide" || cat === "fertilizer";

// ─── App ──────────────────────────────────────────────────────────────────────

function App() {
  // Mode toggle
  const [appMode, setAppMode] = useState<AppMode>("product");

  // ── Product flow state ──────────────────────────────────────────────────────
  const [productViewState, setProductViewState] = useState<ViewState>("upload");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [category, setCategory] = useState<ProductCategory>("pesticide");
  const [productData, setProductData] = useState<ProductInfo | null>(null);
  const [productError, setProductError] = useState<string>("");
  const [searchMode, setSearchMode] = useState<SearchMode>("none");
  const [originalData, setOriginalData] = useState<ProductInfo | null>(null);
  const [searchMetadata, setSearchMetadata] = useState<SearchMetadata | null>(null);
  const [showEnriched, setShowEnriched] = useState(true);

  // ── Receipt flow state ──────────────────────────────────────────────────────
  const [receiptViewState, setReceiptViewState] = useState<ViewState>("upload");
  const [receiptFiles, setReceiptFiles] = useState<File[]>([]);
  const [receiptData, setReceiptData] = useState<ReceiptApiResponse | null>(null);
  const [receiptError, setReceiptError] = useState<string>("");

  const [growingAreaCertificateViewState, setGrowingAreaCertificateViewState] =
    useState<ViewState>("upload");
  const [growingAreaCertificateFiles, setGrowingAreaCertificateFiles] =
    useState<File[]>([]);
  const [growingAreaCertificateData, setGrowingAreaCertificateData] =
    useState<GrowingAreaCertificateApiResponse | null>(null);
  const [growingAreaCertificateError, setGrowingAreaCertificateError] =
    useState<string>("");

  // ─── Mode switch ─────────────────────────────────────────────────────────────

  const handleModeSwitch = (mode: AppMode) => {
    setAppMode(mode);
  };

  // ─── Product handlers ─────────────────────────────────────────────────────────

  const handleFilesSelected = (files: File[]) => {
    setSelectedFiles(files);
    setProductError("");
  };

  const handleProductSubmit = async () => {
    if (selectedFiles.length === 0) {
      setProductError("Vui lòng chọn ít nhất một ảnh");
      return;
    }
    setProductViewState("loading");
    setProductError("");
    try {
      const shouldSearch = searchMode !== "none" && isSearchableCategory(category);
      const response = await uploadMultipleImagesForAnalysis(
        selectedFiles,
        category,
        shouldSearch ? searchMode : "none",
      );
      if (!response.success) {
        setProductError(response.message || "Lỗi khi phân tích ảnh");
        setProductViewState("upload");
        return;
      }
      const productInfo = parseProductInfo(response);
      setProductData(productInfo);
      if (shouldSearch && response.data?.raw) {
        const rawResponse = {
          ...response,
          data: { ...response.data, response: response.data.raw },
        };
        setOriginalData(parseProductInfo(rawResponse));
        setSearchMetadata(response.data.search_metadata ?? null);
        setShowEnriched(true);
      } else {
        setOriginalData(null);
        setSearchMetadata(null);
      }
      setProductViewState("results");
    } catch {
      setProductError("Lỗi khi xử lý ảnh. Vui lòng thử lại.");
      setProductViewState("upload");
    }
  };

  const handleProductReset = () => {
    setSelectedFiles([]);
    setProductData(null);
    setOriginalData(null);
    setSearchMetadata(null);
    setShowEnriched(true);
    setProductError("");
    setProductViewState("upload");
  };

  const displayData =
    originalData && productData
      ? showEnriched
        ? productData
        : originalData
      : productData;

  // ─── Receipt handlers ─────────────────────────────────────────────────────────

  const handleReceiptFilesSelected = (files: File[]) => {
    setReceiptFiles(files);
    setReceiptError("");
  };

  const handleReceiptSubmit = async () => {
    if (receiptFiles.length === 0) {
      setReceiptError("Vui lòng chọn ít nhất một file");
      return;
    }
    setReceiptViewState("loading");
    setReceiptError("");
    try {
      const response = await uploadFilesForReceiptAnalysis(receiptFiles);
      if (!response.success) {
        setReceiptError(response.message || response.error || "Lỗi khi xử lý file");
        setReceiptViewState("upload");
        return;
      }
      setReceiptData(response);
      setReceiptViewState("results");
    } catch {
      setReceiptError("Lỗi khi xử lý file. Vui lòng thử lại.");
      setReceiptViewState("upload");
    }
  };

  const handleReceiptReset = () => {
    setReceiptFiles([]);
    setReceiptData(null);
    setReceiptError("");
    setReceiptViewState("upload");
  };

  const handleGrowingAreaCertificateFilesSelected = (files: File[]) => {
    setGrowingAreaCertificateFiles(files);
    setGrowingAreaCertificateError("");
  };

  const handleGrowingAreaCertificateSubmit = async () => {
    if (growingAreaCertificateFiles.length === 0) {
      setGrowingAreaCertificateError("Vui lòng chọn ít nhất một file");
      return;
    }

    setGrowingAreaCertificateViewState("loading");
    setGrowingAreaCertificateError("");
    try {
      const response = await uploadFilesForGrowingAreaCertificateAnalysis(
        growingAreaCertificateFiles,
      );
      if (!response.success || !response.data) {
        setGrowingAreaCertificateError(
          response.message || response.error || "Lỗi khi xử lý chứng nhận",
        );
        setGrowingAreaCertificateViewState("upload");
        return;
      }

      setGrowingAreaCertificateData(response);
      setGrowingAreaCertificateViewState("results");
    } catch {
      setGrowingAreaCertificateError(
        "Lỗi khi xử lý chứng nhận. Vui lòng thử lại.",
      );
      setGrowingAreaCertificateViewState("upload");
    }
  };

  const handleGrowingAreaCertificateReset = () => {
    setGrowingAreaCertificateFiles([]);
    setGrowingAreaCertificateData(null);
    setGrowingAreaCertificateError("");
    setGrowingAreaCertificateViewState("upload");
  };

  // ─── Styling helpers ──────────────────────────────────────────────────────────

  const getButtonGradient = () => {
    switch (category) {
      case "fish_feed": return "bg-linear-to-r from-blue-600 to-blue-700";
      case "fertilizer": return "bg-linear-to-r from-emerald-600 to-emerald-700";
      case "seed": return "bg-linear-to-r from-green-600 to-green-700";
      default: return "bg-linear-to-r from-purple-600 to-purple-700";
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg py-8 px-4">
      <div className="container mx-auto max-w-2xl">

        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold mb-2">🌾 Nhận diện nông nghiệp</h1>
          <p className="text-lg opacity-90">Tải ảnh để trích xuất thông tin sản phẩm hoặc chứng từ</p>
        </div>

        {/* Mode Toggle Tab Bar */}
        <div className="flex rounded-xl overflow-hidden border border-gray-200 mb-6 shadow-sm bg-white">
          <button
            onClick={() => handleModeSwitch("product")}
            className={`flex-1 py-3 text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
              appMode === "product"
                ? "bg-purple-600 text-white shadow-inner"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            🌿 Nhận diện sản phẩm
          </button>
          <button
            onClick={() => handleModeSwitch("receipt")}
            className={`flex-1 py-3 text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
              appMode === "receipt"
                ? "bg-amber-500 text-white shadow-inner"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            🧾 Đọc phiếu nhập hàng
          </button>
          <button
            onClick={() => handleModeSwitch("growing_area_certificate")}
            className={`flex-1 py-3 text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
              appMode === "growing_area_certificate"
                ? "bg-teal-600 text-white shadow-inner"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            Chứng nhận vùng trồng
          </button>
        </div>

        {/* ── PRODUCT MODE ────────────────────────────────────────────────────── */}
        {appMode === "product" && (
          <>
            {productError && (
              <div className="mb-6 bg-red-100 border-l-4 border-red-500 p-4 rounded text-red-700 text-center">
                {productError}
              </div>
            )}
            <div className="bg-white rounded-xl shadow-xl p-8">
              {productViewState === "upload" && (
                <>
                  <ImageUpload
                    onFilesSelected={handleFilesSelected}
                    category={category}
                    onCategoryChange={setCategory}
                    searchMode={searchMode}
                    onSearchModeChange={setSearchMode}
                    isLoading={false}
                  />
                  <button
                    onClick={handleProductSubmit}
                    disabled={selectedFiles.length === 0}
                    className={`w-full mt-8 py-3 text-white font-semibold rounded-lg hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all ${getButtonGradient()}`}
                  >
                    Phân tích ảnh
                  </button>
                </>
              )}

              {productViewState === "loading" && <LoadingIndicator />}

              {productViewState === "results" && displayData && (
                <>
                  {/* Comparison Toggle */}
                  {originalData && productData && (
                    <div className="flex items-center justify-between mb-6 px-4 py-3 bg-indigo-50 rounded-lg border border-indigo-100">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">
                          {showEnriched ? "📡 Kết quả sau tra cứu" : "📷 Kết quả gốc từ ảnh"}
                        </span>
                        {searchMetadata?.search_status === "enriched" && showEnriched && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                            {searchMode === "interactive" ? "Tra cứu thông minh" : "Đã tra cứu"}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">So sánh</span>
                        <Switch checked={showEnriched} onCheckedChange={setShowEnriched} />
                      </div>
                    </div>
                  )}

                  {category === "pesticide" && (
                    <PesticideResults data={displayData} images={selectedFiles} onReset={handleProductReset} />
                  )}
                  {category === "fertilizer" && (
                    <FertilizerResults data={displayData} images={selectedFiles} onReset={handleProductReset} />
                  )}
                  {category === "fish_feed" && (
                    <FishFeedResults data={displayData} images={selectedFiles} onReset={handleProductReset} />
                  )}
                  {category === "seed" && (
                    <SeedResults data={displayData} images={selectedFiles} onReset={handleProductReset} />
                  )}

                  {searchMetadata?.source_url && showEnriched && (
                    <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-center">
                      <p className="text-xs text-gray-500 mb-1">Nguồn dữ liệu chính thức</p>
                      <a
                        href={searchMetadata.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline break-all"
                      >
                        {searchMetadata.source_url}
                      </a>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}

        {/* ── RECEIPT MODE ────────────────────────────────────────────────────── */}
        {appMode === "receipt" && (
          <>
            {receiptError && (
              <div className="mb-6 bg-red-100 border-l-4 border-red-500 p-4 rounded text-red-700 text-center">
                {receiptError}
              </div>
            )}
            <div className="bg-white rounded-xl shadow-xl p-8">
              {receiptViewState === "upload" && (
                <>
                  <ReceiptUpload
                    onFilesSelected={handleReceiptFilesSelected}
                    isLoading={false}
                  />
                  <button
                    onClick={handleReceiptSubmit}
                    disabled={receiptFiles.length === 0}
                    className="w-full mt-8 py-3 bg-linear-to-r from-amber-500 to-orange-600 text-white font-semibold rounded-lg hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    Phân tích phiếu
                  </button>
                </>
              )}

              {receiptViewState === "loading" && <LoadingIndicator />}

              {receiptViewState === "results" && receiptData && (
                <ReceiptResults
                  response={receiptData}
                  files={receiptFiles}
                  onReset={handleReceiptReset}
                />
              )}
            </div>
          </>
        )}

        {appMode === "growing_area_certificate" && (
          <>
            {growingAreaCertificateError && (
              <div className="mb-6 bg-red-100 border-l-4 border-red-500 p-4 rounded text-red-700 text-center">
                {growingAreaCertificateError}
              </div>
            )}
            <div className="bg-white rounded-xl shadow-xl p-8">
              {growingAreaCertificateViewState === "upload" && (
                <>
                  <GaCertificateUpload
                    onFilesSelected={handleGrowingAreaCertificateFilesSelected}
                    isLoading={false}
                  />
                  <button
                    onClick={handleGrowingAreaCertificateSubmit}
                    disabled={growingAreaCertificateFiles.length === 0}
                    className="w-full mt-8 py-3 bg-linear-to-r from-teal-600 to-cyan-700 text-white font-semibold rounded-lg hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    Phân tích chứng nhận vùng trồng
                  </button>
                </>
              )}

              {growingAreaCertificateViewState === "loading" && (
                <LoadingIndicator />
              )}

              {growingAreaCertificateViewState === "results" &&
                growingAreaCertificateData && (
                  <GaCertificateResults
                    response={growingAreaCertificateData}
                    files={growingAreaCertificateFiles}
                    onReset={handleGrowingAreaCertificateReset}
                  />
                )}
            </div>
          </>
        )}

      </div>
    </div>
  );
}

export default App;
