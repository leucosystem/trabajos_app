/**
 * Redimensiona y comprime una imagen para reducir su peso.
 * @param {File} file - El archivo de imagen original.
 * @param {number} maxWidth - Ancho maximo en pixels (por defecto 1600).
 * @param {number} quality - Calidad JPEG de 0 a 1 (por defecto 0.8).
 * @returns {Promise<Blob>} Blob comprimido de la imagen.
 */
export function compressImage(file, maxWidth = 1600, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;

      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Error al comprimir imagen."))),
        "image/jpeg",
        quality
      );
    };
    img.onerror = () => reject(new Error("No se pudo cargar la imagen."));
    img.src = URL.createObjectURL(file);
  });
}
