import "./JobsList.css";
import { useState } from "react";

function prettyDate(value) {
  if (!value) return "-";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function prettyEstado(value) {
  if (value === "pasado") return "Pasado";
  if (value === "emitido") return "Emitido";
  if (value === "pagada") return "Pagada";
  return "Supervisar";
}

export default function JobsList({ jobs, onEdit, onDelete }) {
  const [selectedJobId, setSelectedJobId] = useState(null);

  return (
    <section className="jobs-list-wrap">
      <div className="jobs-list-head">
        <p className="jobs-list-count">{jobs.length} trabajo{jobs.length !== 1 && "s"} registrado{jobs.length !== 1 && "s"}</p>
      </div>

      {jobs.length === 0 ? (
        <div className="jobs-list-empty">
          <p>Aun no hay trabajos guardados.</p>
          <p>Registra el primero desde la pantalla de Nuevo trabajo.</p>
        </div>
      ) : (
        <div className="jobs-list-table" role="list">
          {jobs.map((job) => (
            (() => {
              const canEdit = (job.estado || "supervisar") === "supervisar";
              return (
            <article
              className={`job-row ${selectedJobId === job.id ? "selected" : ""}`}
              role="listitem"
              key={job.id}
              onClick={() => setSelectedJobId((prev) => (prev === job.id ? null : job.id))}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setSelectedJobId((prev) => (prev === job.id ? null : job.id));
                }
              }}
              tabIndex={0}
              aria-expanded={selectedJobId === job.id}
            >
              <div>
                <p className="job-row-client">{job.cliente || "Sin cliente"}</p>
                <p className="job-row-meta">
                  Estado: <span className={`job-status ${job.estado || "supervisar"}`}>{prettyEstado(job.estado)}</span>
                </p>
                <p className="job-row-meta">Operario: {job.operario || "Sin operario"}</p>
                <p className="job-row-meta">{prettyDate(job.fecha)} • {job.cantidad || "0"} {job.unidad || "cantidad"}</p>
                <p className="job-row-desc">{job.descripcion || "Sin descripcion"}</p>
              </div>

              <div className="job-row-actions">
                <button
                  type="button"
                  className="secondary-btn compact-btn icon-btn"
                  disabled={!canEdit}
                  aria-label="Editar trabajo"
                  title={canEdit ? "Editar" : "Bloqueado: este parte ya no está en Supervisar"}
                  onClick={(event) => {
                    event.stopPropagation();
                    onEdit(job.id);
                  }}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25Zm14.71-9.04a1.003 1.003 0 0 0 0-1.42l-2.5-2.5a1.003 1.003 0 0 0-1.42 0l-1.96 1.96 3.75 3.75 2.13-2.13Z" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="secondary-btn danger-btn compact-btn icon-btn"
                  aria-label="Borrar trabajo"
                  title="Borrar"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(job.id);
                  }}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-2 6h10l-1 11H8L7 9Z" />
                  </svg>
                </button>
              </div>
            </article>
              );
            })()
          ))}
        </div>
      )}
    </section>
  );
}
