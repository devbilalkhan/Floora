export async function getPdfPageCount(file: File): Promise<number> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  return pdf.numPages;
}

// @react-pdf/renderer's <Image> only supports png, jpeg, and svg — formats
// like webp decode fine in <img> tags but silently fail to embed in PDFs.
// Fetch and rasterize anything else to a PNG data URL before handing it to react-pdf.
export async function toPdfSafeDataUrl(url: string): Promise<string | null> {
  try {
    const blob = await fetch(url).then((r) => r.blob());
    if (blob.type === "image/png" || blob.type === "image/jpeg" || blob.type === "image/svg+xml") {
      return await blobToDataUrl(blob);
    }
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0);
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
