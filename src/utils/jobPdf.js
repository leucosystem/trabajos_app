import { jsPDF } from "jspdf";
import { compressImage } from "./compressImage";
import { formatDateToInput } from "./date";

/**
 * Lee un archivo o blob y devuelve su contenido como data URL en base64.
 * @param {File|Blob} file - El archivo o blob a leer.
 * @returns {Promise<string>} Data URL del archivo en base64.
 */
function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
    reader.readAsDataURL(file);
  });
}

function loadImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo cargar la imagen."));
    img.src = dataUrl;
  });
}

async function normalizeImageToAspect(dataUrl, targetAspect, options = {}) {
  const { maxCropRatio = 0.18, backgroundColor = "#ffffff" } = options;
  const img = await loadImageFromDataUrl(dataUrl);
  const sourceAspect = img.width / img.height;

  let croppedAreaRatio = 0;
  if (sourceAspect > targetAspect) {
    const keptWidth = img.height * targetAspect;
    croppedAreaRatio = 1 - keptWidth / img.width;
  } else if (sourceAspect < targetAspect) {
    const keptHeight = img.width / targetAspect;
    croppedAreaRatio = 1 - keptHeight / img.height;
  }

  const canvasW = 1200;
  const canvasH = Math.max(1, Math.round(canvasW / targetAspect));
  const canvas = document.createElement("canvas");
  canvas.width = canvasW;
  canvas.height = canvasH;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return dataUrl;
  }

  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Si el recorte sería muy agresivo, priorizamos conservar todo el contenido (contain).
  if (croppedAreaRatio > maxCropRatio) {
    let drawW = canvas.width;
    let drawH = drawW / sourceAspect;

    if (drawH > canvas.height) {
      drawH = canvas.height;
      drawW = drawH * sourceAspect;
    }

    const dx = (canvas.width - drawW) / 2;
    const dy = (canvas.height - drawH) / 2;
    ctx.drawImage(img, dx, dy, drawW, drawH);
    return canvas.toDataURL("image/jpeg", 0.92);
  }

  // Si el recorte es razonable, aplicamos cover centrado para mantener uniformidad visual.
  let sx = 0;
  let sy = 0;
  let sw = img.width;
  let sh = img.height;

  if (sourceAspect > targetAspect) {
    sw = img.height * targetAspect;
    sx = (img.width - sw) / 2;
  } else if (sourceAspect < targetAspect) {
    sh = img.width / targetAspect;
    sy = (img.height - sh) / 2;
  }

  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.92);
}

/**
 * Genera un PDF de parte de trabajo con datos del cliente, descripcion, fotos y firma.
 * @param {Object} params
 * @param {Object} params.formData - Campos del formulario (cliente, fecha, descripcion, cantidad, unidad).
 * @param {Array<{file: File, info: string}>} params.photos - Fotos con texto informativo opcional.
 * @param {string|null} params.signature - Data URL PNG de la firma del cliente, o null si no hay.
 * @param {'download'|'blob'|'preview'} params.output - Tipo de salida deseada.
 * @returns {Promise<void|string|{blob: Blob, fileName: string}>}
 */
export async function generateJobPdf({ formData, photos, signature, output = "download" }) {
  const operatorName = (formData.operario || "Operario").trim();
  const title = `Trabajo de ${operatorName}`;

  const quantityLabel =
    formData.unidad === "cantidad"
      ? `Cantidad: ${formData.cantidad || "0"}`
      : `Cantidad: ${formData.cantidad || "0"} ${formData.unidad}`;

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let y = 18;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(title, pageWidth / 2, y, { align: "center" });
  y += 10;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`Cliente: ${formData.cliente || "-"}`, margin, y);
  y += 7;
  doc.text(`Fecha: ${formData.fecha || "-"}`, margin, y);
  y += 7;

  doc.setFont("helvetica", "bold");
  doc.text("Descripcion:", margin, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  const descriptionLines = doc.splitTextToSize(formData.descripcion || "-", contentWidth);
  doc.text(descriptionLines, margin, y);
  y += descriptionLines.length * 5 + 2;
  doc.text(quantityLabel, margin, y);
  y += 8;

  // Primera página: 6 fotos (3x2) junto a datos del parte.
  // Páginas siguientes: 9 fotos (3x3), solo fotos.
  const PHOTO_CELL_W = 60; // 6 cm
  const PHOTO_CELL_H = 79; // 7.9 cm
  const PHOTO_COLS = 3;
  const FIRST_PAGE_ROWS = 2;
  const NEXT_PAGE_ROWS = 3;
  const FIRST_PAGE_PHOTOS = PHOTO_COLS * FIRST_PAGE_ROWS; // 6
  const NEXT_PAGE_PHOTOS = PHOTO_COLS * NEXT_PAGE_ROWS; // 9
  const photoInfoFontSize = 8;
  const photoInfoLineH = 3.2;
  const photoInfoMaxLines = 2;
  const photoInfoReservedH = photoInfoMaxLines * photoInfoLineH + 1;
  const photoDrawH = PHOTO_CELL_H - photoInfoReservedH;
  const rowGap = 4;
  const colGap = Math.max(1, (contentWidth - PHOTO_COLS * PHOTO_CELL_W) / (PHOTO_COLS - 1));

  // Preparar todas las fotos ya recortadas al mismo ratio visual.
  const allPhotos = [];
  const targetAspect = PHOTO_CELL_W / photoDrawH;
  for (const photo of photos) {
    const compressed = await compressImage(photo.file);
    const imageData = await readFileAsDataUrl(compressed);
    const croppedImageData = await normalizeImageToAspect(imageData, targetAspect, {
      maxCropRatio: 0.18,
      backgroundColor: "#ffffff",
    });
    const infoText = photo.info?.trim() || "";
    const infoLines = infoText ? doc.splitTextToSize(infoText, PHOTO_CELL_W).slice(0, photoInfoMaxLines) : [];
    allPhotos.push({ imageData: croppedImageData, imageType: "JPEG", infoLines });
  }

  function gridHeight(rows) {
    return rows * PHOTO_CELL_H + (rows - 1) * rowGap;
  }

  function renderPhotoCell(photo, cellX, cellY) {
    doc.addImage(photo.imageData, photo.imageType, cellX, cellY, PHOTO_CELL_W, photoDrawH);

    if (photo.infoLines.length > 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(photoInfoFontSize);
      doc.text(photo.infoLines, cellX, cellY + photoDrawH + photoInfoLineH);
    }
  }

  // Render primera página (máx. 6 fotos)
  const firstBatch = allPhotos.slice(0, FIRST_PAGE_PHOTOS);
  if (firstBatch.length > 0) {
    let startY = y;
    const firstGridH = gridHeight(FIRST_PAGE_ROWS);
    if (startY + firstGridH > pageHeight - margin) {
      doc.addPage();
      startY = margin;
    }

    firstBatch.forEach((photo, idx) => {
      const row = Math.floor(idx / PHOTO_COLS);
      const col = idx % PHOTO_COLS;
      const cellX = margin + col * (PHOTO_CELL_W + colGap);
      const cellY = startY + row * (PHOTO_CELL_H + rowGap);
      renderPhotoCell(photo, cellX, cellY);
    });

    y = startY + firstGridH;
  }

  // Render páginas siguientes (solo fotos, máx. 9 por página)
  const remainingPhotos = allPhotos.slice(FIRST_PAGE_PHOTOS);
  for (let i = 0; i < remainingPhotos.length; i += NEXT_PAGE_PHOTOS) {
    doc.addPage();
    const pagePhotos = remainingPhotos.slice(i, i + NEXT_PAGE_PHOTOS);
    const startY = margin;

    pagePhotos.forEach((photo, idx) => {
      const row = Math.floor(idx / PHOTO_COLS);
      const col = idx % PHOTO_COLS;
      const cellX = margin + col * (PHOTO_CELL_W + colGap);
      const cellY = startY + row * (PHOTO_CELL_H + rowGap);
      renderPhotoCell(photo, cellX, cellY);
    });

    y = startY + gridHeight(NEXT_PAGE_ROWS);
  }

  // Firma siempre al final de la ultima pagina
  if (signature) {
    const sigProps = doc.getImageProperties(signature);
    const maxSigWidth = contentWidth * 0.28;
    let sigWidth = maxSigWidth;
    let sigHeight = (sigProps.height * sigWidth) / sigProps.width;
    const maxSigH = 18;

    if (sigHeight > maxSigH) {
      sigHeight = maxSigH;
      sigWidth = (sigProps.width * sigHeight) / sigProps.height;
    }

    const sigBlockHeight = 4 + 6 + sigHeight + 5;
    if (y + sigBlockHeight > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }

    y += 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Firma del cliente:", margin, y);
    y += 6;
    doc.addImage(signature, "PNG", margin, y, sigWidth, sigHeight);
    y += sigHeight + 5;
  }

  // Si el PDF tiene más de una página, numeramos abajo a la derecha.
  const totalPages = doc.getNumberOfPages();
  if (totalPages > 1) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    for (let pageNum = 1; pageNum <= totalPages; pageNum += 1) {
      doc.setPage(pageNum);
      doc.text(`Pagina: ${pageNum}/${totalPages}`, pageWidth - margin, pageHeight - 6, { align: "right" });
    }
  }

  const safeDate = formData.fecha || formatDateToInput(new Date());
  const safeClient = (formData.cliente || "cliente").trim().replace(/\s+/g, "-").toLowerCase();
  const fileName = `trabajo-${safeClient}-${safeDate}.pdf`;
  const blob = doc.output("blob");

  if (output === "preview") {
    return URL.createObjectURL(blob);
  }

  if (output === "blob") {
    return { blob, fileName };
  }

  doc.save(fileName);
}

export function downloadPdfBlob(blob, fileName) {
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName || "trabajo.pdf";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
