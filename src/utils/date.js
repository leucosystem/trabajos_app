/**
 * Formatea un objeto Date al formato YYYY-MM-DD para inputs de tipo date.
 * @param {Date} date - La fecha a formatear.
 * @returns {string} Fecha en formato "YYYY-MM-DD".
 */
export function formatDateToInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
