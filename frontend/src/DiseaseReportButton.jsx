import { useState } from "react";
import { Download, FileText, LoaderCircle } from "lucide-react";
import { jsPDF } from "jspdf";
import "./DiseaseReportButton.css";

function sourceToJpegDataUrl(source, maxDimension = 1100) {
  return new Promise((resolve, reject) => {
    if (!source) {
      resolve(null);
      return;
    }
    const objectUrl = typeof source === "string" ? source : URL.createObjectURL(source);
    const shouldRevoke = typeof source !== "string";
    const image = new Image();
    image.onload = () => {
      try {
        const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
        canvas.height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Could not process an image for the PDF.");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
        if (shouldRevoke) URL.revokeObjectURL(objectUrl);
        resolve(dataUrl);
      } catch (error) {
        if (shouldRevoke) URL.revokeObjectURL(objectUrl);
        reject(error);
      }
    };
    image.onerror = () => {
      if (shouldRevoke) URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not load an image for the PDF report."));
    };
    image.src = objectUrl;
  });
}

function cleanFileName(value) {
  return String(value || "plant-diagnosis")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "plant-diagnosis";
}

export default function DiseaseReportButton({ result, image, heatmap }) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const generateReport = async () => {
    if (!result || !image) {
      setError("Run a plant diagnosis before downloading the report.");
      return;
    }

    setGenerating(true);
    setError("");
    try {
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 17;
      const contentWidth = pageWidth - margin * 2;
      let y = 48;

      const ensureSpace = (height) => {
        if (y + height > pageHeight - 18) {
          pdf.addPage();
          y = 20;
        }
      };

      const section = (heading) => {
        ensureSpace(12);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(13);
        pdf.setTextColor(35, 100, 55);
        pdf.text(heading, margin, y);
        y += 7;
      };

      const paragraph = (value, options = {}) => {
        const text = String(value ?? "").trim();
        if (!text) return;
        pdf.setFont("helvetica", options.bold ? "bold" : "normal");
        pdf.setFontSize(options.size || 10.5);
        pdf.setTextColor(...(options.color || [56, 72, 60]));
        const lines = pdf.splitTextToSize(text, contentWidth);
        const blockHeight = lines.length * 5.2 + (options.gap ?? 3);
        ensureSpace(blockHeight);
        pdf.text(lines, margin, y);
        y += blockHeight;
      };

      const bulletList = (values, fallback) => {
        const list = Array.isArray(values) && values.length ? values : [fallback];
        list.forEach((item) => paragraph(`- ${item}`));
      };

      // Report banner
      pdf.setFillColor(16, 55, 31);
      pdf.rect(0, 0, pageWidth, 37, "F");
      pdf.setTextColor(241, 255, 242);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(21);
      pdf.text("AI Plant Doctor", margin, 16);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(188, 224, 194);
      pdf.text("Plant Disease Analysis Report", margin, 24);
      pdf.setFontSize(8.5);
      pdf.text(`Generated: ${new Date().toLocaleString()}`, margin, 31);

      section("Diagnosis summary");
      paragraph(`Plant: ${result.plant || "Unknown"}`, { bold: true });
      paragraph(`Predicted condition: ${result.disease || "Unknown"}`, { bold: true });
      paragraph(`Model status: ${result.status || "Prediction available"}`);
      paragraph(`Model confidence: ${Number(result.confidence || 0).toFixed(2)}%`);
      paragraph("Confidence is the model's score for its predicted class; it is not a measure of disease severity.", { size: 9, color: [105, 116, 106] });

      section("Uploaded leaf image");
      const originalJpeg = await sourceToJpegDataUrl(image);
      if (originalJpeg) {
        const imageInfo = pdf.getImageProperties(originalJpeg);
        const maxW = Math.min(100, contentWidth);
        const maxH = 62;
        const scale = Math.min(maxW / imageInfo.width, maxH / imageInfo.height);
        const imgW = imageInfo.width * scale;
        const imgH = imageInfo.height * scale;
        ensureSpace(imgH + 5);
        pdf.addImage(originalJpeg, "JPEG", margin, y, imgW, imgH, undefined, "MEDIUM");
        y += imgH + 6;
      }

      const info = result.diseaseInfo || {};
      section("Disease information");
      paragraph(info.description || "No detailed disease description was provided by the backend.");

      section("Treatment and recommended actions");
      bulletList(
        info.treatment,
        info.status === "healthy"
          ? "Continue appropriate watering, sunlight, and regular monitoring."
          : "Inspect affected leaves, improve airflow where appropriate, and ask a local agricultural expert about suitable treatment."
      );

      section("Prevention and care");
      bulletList(
        info.prevention,
        "Use clean tools, monitor new growth, avoid unnecessary leaf wetness, and follow crop-specific local advice."
      );

      if (heatmap) {
        try {
          section("Grad-CAM explanation");
          paragraph("The heatmap is an explanation aid showing regions that influenced the model's prediction. It does not independently confirm a disease or mark exact lesion boundaries.", { size: 9.5 });
          const heatmapJpeg = await sourceToJpegDataUrl(heatmap, 900);
          if (heatmapJpeg) {
            const heatInfo = pdf.getImageProperties(heatmapJpeg);
            const maxW = Math.min(100, contentWidth);
            const maxH = 62;
            const scale = Math.min(maxW / heatInfo.width, maxH / heatInfo.height);
            const imgW = heatInfo.width * scale;
            const imgH = heatInfo.height * scale;
            ensureSpace(imgH + 5);
            pdf.addImage(heatmapJpeg, "JPEG", margin, y, imgW, imgH, undefined, "MEDIUM");
            y += imgH + 6;
          }
        } catch (heatmapError) {
          console.warn("The Grad-CAM image was omitted from the PDF:", heatmapError);
        }
      }

      section("Important note");
      paragraph("This report is generated from an AI image-classification result and general plant-care information. Image quality, lighting, background, and differences from the training dataset can affect predictions. Do not treat this report as a guaranteed diagnosis or apply chemical treatments without checking product labels and local agricultural guidance.", { size: 9.5 });

      const totalPages = pdf.getNumberOfPages();
      for (let page = 1; page <= totalPages; page += 1) {
        pdf.setPage(page);
        pdf.setDrawColor(224, 234, 224);
        pdf.line(margin, pageHeight - 13, pageWidth - margin, pageHeight - 13);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.setTextColor(113, 128, 116);
        pdf.text(`AI Plant Doctor | Page ${page} of ${totalPages}`, pageWidth / 2, pageHeight - 8, { align: "center" });
      }

      pdf.save(`${cleanFileName(result.plant)}-${cleanFileName(result.disease)}-report.pdf`);
    } catch (reportError) {
      console.error("PDF report generation failed:", reportError);
      setError(reportError.message || "Could not generate the PDF report. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="disease-report-control">
      <button className="disease-report-btn" type="button" onClick={generateReport} disabled={!result || !image || generating}>
        {generating ? <><LoaderCircle className="disease-report-spin" size={18} /> Preparing PDF report...</> : <><Download size={18} /> Download Detailed PDF Report <FileText size={17} /></>}
      </button>
      {error && <p className="disease-report-error" role="alert">{error}</p>}
    </div>
  );
}
