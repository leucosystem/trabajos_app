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

/**
 * Genera un PDF de parte de trabajo con datos del cliente, descripcion, fotos y firma.
 * @param {Object} params
 * @param {Object} params.formData - Campos del formulario (cliente, fecha, descripcion, cantidad, unidad).
 * @param {Array<{file: File, info: string}>} params.photos - Fotos con texto informativo opcional.
 * @param {string|null} params.signature - Data URL PNG de la firma del cliente, o null si no hay.
 * @param {boolean} params.preview - Si es true, devuelve un blob URL en vez de descargar.
 * @returns {Promise<string|void>} Blob URL si preview=true, o descarga el PDF.
 */
export async function generateJobPdf({ formData, photos, signature, preview = false }) {
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
  doc.text("Trabajo de Iv\u00e1n", pageWidth / 2, y, { align: "center" });
  y += 10;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`Cliente: ${formData.cliente || "-"}`, margin, y);
  y += 7;
  doc.text(`Operario: ${formData.operario || "-"}`, margin, y);
  y += 7;
  doc.text(`Fecha: ${formData.fecha || "-"}`, margin, y);
  y += 7;
  doc.text(quantityLabel, margin, y);
  y += 9;

  doc.setFont("helvetica", "bold");
  doc.text("Descripcion:", margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  const descriptionLines = doc.splitTextToSize(formData.descripcion || "-", contentWidth);
  doc.text(descriptionLines, margin, y);
  y += descriptionLines.length * 5 + 6;

  // Preparar todas las fotos
  const allPhotos = [];
  for (const photo of photos) {
    const compressed = await compressImage(photo.file);
    const imageData = await readFileAsDataUrl(compressed);
    const imageProps = doc.getImageProperties(imageData);
    const infoText = photo.info?.trim() || "";
    allPhotos.push({ imageData, imageType: "JPEG", imageProps, infoText });
  }

  const photoInfoFontSize = 9;
  const infoLineHeight = 4;
  const gap = 6;
  const rowGap = 5;
  const colWidth = (contentWidth - gap) / 2;

  /**
   * Renderiza un par de fotos (1 fila) con altura maxima fija por celda.
   * Las fotos se escalan para caber en (colWidth x maxRowH) manteniendo proporcion.
   * El texto informativo se centra arriba de cada foto.
   */
  function renderPhotoPair(pair, maxRowH, startY) {
    const isSingle = pair.length === 1;
    const photoWidth = isSingle ? contentWidth : colWidth;

    const rendered = pair.map((p) => {
      const hasInfo = p.infoText.length > 0;
      const infoH = hasInfo ? infoLineHeight + 3 : 0;
      const maxPhotoH = maxRowH - infoH;
      let w = photoWidth;
      let h = (p.imageProps.height * w) / p.imageProps.width;

      if (h > maxPhotoH) {
        h = maxPhotoH;
        w = (p.imageProps.width * h) / p.imageProps.height;
      }

      return { ...p, w, h, hasInfo, infoH };
    });

    const tallestH = Math.max(...rendered.map((r) => r.h));
    const hasAnyInfo = rendered.some((r) => r.hasInfo);
    const textOffset = hasAnyInfo ? infoLineHeight + 3 : 0;

    rendered.forEach((r, idx) => {
      const x = isSingle ? margin : margin + idx * (colWidth + gap);

      if (r.hasInfo) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(photoInfoFontSize);
        doc.text(r.infoText, x, startY + infoLineHeight);
      }

      doc.addImage(r.imageData, r.imageType, x, startY + textOffset, r.w, r.h);
    });

    return tallestH + textOffset;
  }

  // Altura fija por fila: calcular cuantas filas caben en cada pagina
  const sigReserved = signature ? 28 : 0;
  const photosPerPage = 4; // 2 filas de 2
  const rowsPerPage = 2;

  // Pagina 1: espacio disponible despues del texto del formulario
  const page1Available = pageHeight - margin - y - (allPhotos.length <= photosPerPage ? sigReserved : 0);
  const page1RowH = (page1Available - rowGap) / rowsPerPage;

  // Paginas siguientes: espacio completo
  const fullPageAvailable = pageHeight - margin * 2;

  // Dividir fotos en pares
  const pairs = [];
  for (let i = 0; i < allPhotos.length; i += 2) {
    pairs.push(allPhotos.slice(i, i + 2));
  }

  // Pagina 1: hasta 2 pares (4 fotos)
  const page1Pairs = pairs.slice(0, rowsPerPage);
  page1Pairs.forEach((pair, rowIdx) => {
    const usedH = renderPhotoPair(pair, page1RowH, y);
    y += usedH + rowGap;
  });

  // Paginas siguientes: 4 fotos por pagina
  const remainingPairs = pairs.slice(rowsPerPage);
  for (let i = 0; i < remainingPairs.length; i++) {
    const rowInPage = i % rowsPerPage;

    if (rowInPage === 0) {
      doc.addPage();
      y = margin;
    }

    const isLastPage = i + rowsPerPage >= remainingPairs.length;
    const reserve = (signature && isLastPage) ? sigReserved : 0;
    const pageAvail = fullPageAvailable - reserve;
    const fullRowH = (pageAvail - rowGap) / rowsPerPage;

    const usedH = renderPhotoPair(remainingPairs[i], fullRowH, y);
    y += usedH + rowGap;
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

    y += 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Firma del cliente:", margin, y);
    y += 6;
    doc.addImage(signature, "PNG", margin, y, sigWidth, sigHeight);
    y += sigHeight + 5;
  }

  if (preview) {
    const blob = doc.output("blob");
    return URL.createObjectURL(blob);
  }

  const safeDate = formData.fecha || formatDateToInput(new Date());
  const safeClient = (formData.cliente || "cliente").trim().replace(/\s+/g, "-").toLowerCase();
  doc.save(`trabajo-${safeClient}-${safeDate}.pdf`);
}
