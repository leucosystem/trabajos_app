import "./JobForm.css";
import PhotoPreview from "./PhotoPreview";

/**
 * Formulario para registrar un parte de trabajo.
 * Incluye campos de cliente, fecha, descripcion, cantidad y fotos.
 */
export default function JobForm({
  formData,
  photos,
  signature,
  isAdmin,
  assignableUsers,
  isLoadingAssignableUsers,
  isFormValid,
  isGeneratingPdf,
  isEditing,
  onSubmit,
  onGeneratePdf,
  onCancelEdit,
  onChange,
  onCantidadChange,
  onOperarioUserChange,
  onSetTodayDate,
  onPhotosChange,
  onClearPhotos,
  onRemovePhoto,
  onReorderPhotos,
  onPhotoInfoChange,
  onRequestSignature,
  onClearSignature,
}) {
  return (
    <form className="job-form" onSubmit={onSubmit}>
      {isAdmin && (
        <label className="form-field" htmlFor="operarioUserId">
          Usuario
          <select
            id="operarioUserId"
            name="operarioUserId"
            required
            value={formData.operarioUserId}
            onChange={(event) => onOperarioUserChange(event.target.value)}
            disabled={isLoadingAssignableUsers}
          >
            <option value="">Selecciona un usuario</option>
            {assignableUsers.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="form-field" htmlFor="cliente">
        Cliente
        <input
          id="cliente"
          name="cliente"
          type="text"
          required
          value={formData.cliente}
          onChange={onChange}
          placeholder="Nombre del cliente"
          autoComplete="off"
        />
      </label>

      <div className="form-field">
        <label htmlFor="fecha">Fecha</label>
        <div className="date-row">
          <input
            className="date-input"
            id="fecha"
            name="fecha"
            type="date"
            required
            value={formData.fecha}
            onChange={onChange}
          />
          <button type="button" className="secondary-btn today-btn" onClick={onSetTodayDate}>
            Hoy
          </button>
        </div>
      </div>

      {isAdmin && isEditing && (
        <label className="form-field" htmlFor="estado">
          Estado
          <select
            id="estado"
            name="estado"
            value={formData.estado || "supervisar"}
            onChange={onChange}
          >
            <option value="supervisar">Supervisar</option>
            <option value="pasado">Pasado</option>
            <option value="emitido">Emitido</option>
            <option value="pagada">Pagada</option>
          </select>
        </label>
      )}

      <label className="form-field" htmlFor="descripcion">
        Descripcion
        <textarea
          id="descripcion"
          name="descripcion"
          rows="4"
          required
          value={formData.descripcion}
          onChange={onChange}
          placeholder="Detalles del trabajo"
        />
      </label>

      <div className="form-field">
        <label htmlFor="cantidad">Cantidad</label>
        <div className="quantity-row">
          <input
            id="cantidad"
            name="cantidad"
            type="number"
            min="0"
            step="0.1"
            required
            value={formData.cantidad}
            onChange={onCantidadChange}
            placeholder="0"
          />
          <select name="unidad" value={formData.unidad} onChange={onChange}>
            <option value="kilos">Kilos</option>
            <option value="horas">Horas</option>
            <option value="cantidad">Cantidad</option>
            <option value="hectareas">Hectareas</option>
          </select>
        </div>
      </div>

      <div className="form-field">
        <label>Fotos (opcional)</label>
        <label className="file-input-btn secondary-btn" role="button" tabIndex={0}>
          Anadir fotos
          <input type="file" accept="image/*" multiple onChange={onPhotosChange} hidden />
        </label>
      </div>

      <PhotoPreview
        photos={photos}
        onClearPhotos={onClearPhotos}
        onRemovePhoto={onRemovePhoto}
        onReorderPhotos={onReorderPhotos}
        onPhotoInfoChange={onPhotoInfoChange}
      />

      <div className="form-field">
        <label>Firma del cliente (opcional)</label>
        {signature ? (
          <div className="signature-preview">
            <img src={signature} alt="Firma del cliente" className="signature-preview-img" />
            <div className="signature-preview-actions">
              <button type="button" className="secondary-btn" onClick={onRequestSignature}>
                Repetir firma
              </button>
              <button type="button" className="secondary-btn" onClick={onClearSignature}>
                Quitar firma
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="secondary-btn" onClick={onRequestSignature}>
            Pedir firma
          </button>
        )}
      </div>

      <div className="form-actions">
        <button type="submit" className="primary-btn" disabled={!isFormValid || isGeneratingPdf} aria-busy={isGeneratingPdf}>
          {isEditing ? "Actualizar trabajo" : "Guardar trabajo"}
        </button>

        <button
          type="button"
          className="secondary-btn"
          disabled={!isFormValid || isGeneratingPdf}
          onClick={onGeneratePdf}
        >
          {isGeneratingPdf ? "Generando PDF..." : "Guardar y generar PDF"}
        </button>

        {isEditing && (
          <button type="button" className="secondary-btn" onClick={onCancelEdit}>
            Cancelar edicion
          </button>
        )}
      </div>
    </form>
  );
}
