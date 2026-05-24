import { useEffect, useRef, useCallback } from "react";
import "./SignaturePad.css";

/**
 * Panel de firma a pantalla completa.
 * Dibuja sobre un canvas y devuelve la firma como data URL PNG al confirmar.
 * @param {Object} props
 * @param {function} props.onConfirm - Callback con la firma (data URL) al aceptar.
 * @param {function} props.onCancel - Callback al cancelar sin firmar.
 */
export default function SignaturePad({ onConfirm, onCancel }) {
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const hasStrokesRef = useRef(false);

  /** Obtiene las coordenadas relativas al canvas desde un evento touch o mouse. */
  const getPosition = useCallback((event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const point = event.touches ? event.touches[0] : event;
    return {
      x: point.clientX - rect.left,
      y: point.clientY - rect.top,
    };
  }, []);

  /** Inicia un trazo en la posicion del evento. */
  const startDrawing = useCallback(
    (event) => {
      event.preventDefault();
      isDrawingRef.current = true;
      const ctx = canvasRef.current.getContext("2d");
      const pos = getPosition(event);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    },
    [getPosition]
  );

  /** Dibuja una linea hasta la posicion actual del evento. */
  const draw = useCallback(
    (event) => {
      if (!isDrawingRef.current) return;
      event.preventDefault();
      const ctx = canvasRef.current.getContext("2d");
      const pos = getPosition(event);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      hasStrokesRef.current = true;
    },
    [getPosition]
  );

  /** Finaliza el trazo actual. */
  const stopDrawing = useCallback(() => {
    isDrawingRef.current = false;
  }, []);

  /** Limpia todo el canvas. */
  function clearCanvas() {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasStrokesRef.current = false;
  }

  /** Recorta el canvas al area dibujada, eliminando el espacio en blanco. */
  function trimCanvas(canvas) {
    const ctx = canvas.getContext("2d");
    const { width, height } = canvas;
    const imageData = ctx.getImageData(0, 0, width, height);
    const { data } = imageData;

    let top = height, left = width, right = 0, bottom = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const alpha = data[(y * width + x) * 4 + 3];
        if (alpha > 0) {
          if (y < top) top = y;
          if (y > bottom) bottom = y;
          if (x < left) left = x;
          if (x > right) right = x;
        }
      }
    }

    if (right <= left || bottom <= top) return canvas.toDataURL("image/png");

    const padding = Math.round(10 * window.devicePixelRatio);
    top = Math.max(0, top - padding);
    left = Math.max(0, left - padding);
    right = Math.min(width - 1, right + padding);
    bottom = Math.min(height - 1, bottom + padding);

    const trimmedWidth = right - left + 1;
    const trimmedHeight = bottom - top + 1;
    const trimmed = document.createElement("canvas");
    trimmed.width = trimmedWidth;
    trimmed.height = trimmedHeight;
    trimmed.getContext("2d").putImageData(
      ctx.getImageData(left, top, trimmedWidth, trimmedHeight),
      0,
      0
    );

    return trimmed.toDataURL("image/png");
  }

  /** Confirma la firma y la envia como data URL recortada. */
  function handleConfirm() {
    if (!hasStrokesRef.current) return;
    const dataUrl = trimCanvas(canvasRef.current);
    onConfirm(dataUrl);
  }

  /** Ajusta el tamaño del canvas al tamaño real del contenedor. */
  useEffect(() => {
    const canvas = canvasRef.current;

    function resize() {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;

      const ctx = canvas.getContext("2d");
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#1a1a1a";
    }

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  return (
    <div className="signature-overlay">
      <div className="signature-header">
        <span className="signature-title">Firma del cliente</span>
        <div className="signature-actions">
          <button type="button" className="signature-btn signature-btn--clear" onClick={clearCanvas}>
            Limpiar
          </button>
          <button type="button" className="signature-btn signature-btn--cancel" onClick={onCancel}>
            Cancelar
          </button>
          <button type="button" className="signature-btn signature-btn--confirm" onClick={handleConfirm}>
            Aceptar
          </button>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className="signature-canvas"
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
      />
    </div>
  );
}
