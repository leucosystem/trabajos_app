import { useState, useRef, useCallback, useEffect } from "react";
import "./PhotoPreview.css";

/**
 * Muestra una cuadricula con la previsualizacion de las fotos adjuntas.
 * Permite eliminar fotos individuales, limpiar todas, reordenar con drag & drop
 * y editar su texto informativo.
 */
export default function PhotoPreview({
  photos,
  onClearPhotos,
  onRemovePhoto,
  onReorderPhotos,
  onPhotoInfoChange,
}) {
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);
  const touchRef = useRef({ startIdx: null, clone: null, active: false, timer: null, startX: 0, startY: 0 });
  const touchActiveRef = useRef(false);
  const gridRef = useRef(null);

  /* ---------- Touch helpers (definidos antes del useEffect) ---------- */
  const getCardRects = useCallback(() => {
    if (!gridRef.current) return [];
    return Array.from(gridRef.current.children).map((el) => el.getBoundingClientRect());
  }, []);

  const hitTest = useCallback((x, y, rects) => {
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i];
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return i;
    }
    return null;
  }, []);

  const cleanupTouch = useCallback(() => {
    const t = touchRef.current;
    if (t.timer) clearTimeout(t.timer);
    if (t.clone) t.clone.remove();
    touchRef.current = { startIdx: null, clone: null, active: false, timer: null, startX: 0, startY: 0 };
    touchActiveRef.current = false;
    setDragIdx(null);
    setOverIdx(null);
  }, []);

  // Limpiar ghost huerfano al desmontar
  useEffect(() => {
    return () => {
      const t = touchRef.current;
      if (t.timer) clearTimeout(t.timer);
      if (t.clone) t.clone.remove();
    };
  }, []);

  // touchmove NO pasivo para poder bloquear scroll con preventDefault
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const onTouchMove = (e) => {
      const t = touchRef.current;
      if (t.startIdx === null) return;

      const touch = e.touches[0];
      const dx = touch.clientX - t.startX;
      const dy = touch.clientY - t.startY;

      if (!t.active) {
        if (Math.abs(dx) > 10 || Math.abs(dy) > 10) cleanupTouch();
        return;
      }

      e.preventDefault();
      t.clone.style.left = t.origLeft + dx + "px";
      t.clone.style.top = t.origTop + dy + "px";

      const target = hitTest(touch.clientX, touch.clientY, getCardRects());
      setOverIdx(target);
    };

    grid.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => grid.removeEventListener("touchmove", onTouchMove);
  }, [cleanupTouch, hitTest, getCardRects, photos.length]);

  /* ---------- Pointer / mouse drag ---------- */
  const handleDragStart = useCallback((e, idx) => {
    // Bloquear drag nativo si hay un touch activo (evita ghost del navegador)
    if (touchActiveRef.current) {
      e.preventDefault();
      return;
    }
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", idx);
  }, []);

  const handleDragOver = useCallback((e, idx) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setOverIdx(idx);
  }, []);

  const handleDrop = useCallback(
    (e, toIdx) => {
      e.preventDefault();
      const fromIdx = dragIdx;
      setDragIdx(null);
      setOverIdx(null);
      if (fromIdx !== null && fromIdx !== toIdx) {
        onReorderPhotos(fromIdx, toIdx);
      }
    },
    [dragIdx, onReorderPhotos],
  );

  const handleDragEnd = useCallback(() => {
    setDragIdx(null);
    setOverIdx(null);
  }, []);

  /* ---------- Touch drag ---------- */
  const handleTouchStart = useCallback((e, idx) => {
    const touch = e.touches[0];
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();

    touchActiveRef.current = true;

    touchRef.current = {
      startIdx: idx,
      clone: null,
      active: false,
      timer: null,
      card,
      startX: touch.clientX,
      startY: touch.clientY,
      origLeft: rect.left,
      origTop: rect.top,
      width: rect.width,
    };

    // Solo activar drag tras mantener pulsado 200ms
    touchRef.current.timer = setTimeout(() => {
      const t = touchRef.current;
      if (t.startIdx === null) return;
      t.active = true;

      const clone = t.card.cloneNode(true);
      clone.classList.add("photo-card-ghost");
      clone.style.width = t.width + "px";
      clone.style.left = t.origLeft + "px";
      clone.style.top = t.origTop + "px";
      document.body.appendChild(clone);
      t.clone = clone;

      setDragIdx(idx);
    }, 200);
  }, []);

  const handleTouchEnd = useCallback(() => {
    const t = touchRef.current;
    const wasActive = t.active;
    const fromIdx = t.startIdx;
    const toIdx = overIdx;
    cleanupTouch();
    if (wasActive && fromIdx !== null && toIdx !== null && fromIdx !== toIdx) {
      onReorderPhotos(fromIdx, toIdx);
    }
  }, [overIdx, onReorderPhotos, cleanupTouch]);

  if (photos.length === 0) return null;

  return (
    <section className="photo-preview">
      <div className="photo-preview-head">
        <span className="photo-count">{photos.length} foto{photos.length !== 1 && "s"}</span>
        <button type="button" className="secondary-btn" onClick={onClearPhotos}>
          Limpiar fotos
        </button>
      </div>

      <div className="photo-grid" ref={gridRef}>
        {photos.map((photo, idx) => {
          let cls = "photo-card";
          if (dragIdx === idx) cls += " dragging";
          if (overIdx === idx && dragIdx !== idx) cls += " drag-over";

          return (
            <figure
              className={cls}
              key={photo.id}
              draggable
              onDragStart={(e) => handleDragStart(e, idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={(e) => handleDrop(e, idx)}
              onDragEnd={handleDragEnd}
              onTouchStart={(e) => handleTouchStart(e, idx)}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={cleanupTouch}
            >
              <button
                type="button"
                className="remove-photo-btn"
                aria-label={`Quitar foto ${photo.file.name}`}
                title="Quitar foto"
                onClick={() => onRemovePhoto(photo.id)}
              >
                ✕
              </button>

              <img src={photo.url} alt={photo.file.name} draggable={false} />
              <figcaption>{photo.file.name}</figcaption>

              <textarea
                className="photo-info-input"
                rows="2"
                value={photo.info}
                onChange={(event) => onPhotoInfoChange(photo.id, event.target.value)}
                placeholder="Informacion de la foto (ej: Parcela 1)"
              />
            </figure>
          );
        })}
      </div>
    </section>
  );
}
