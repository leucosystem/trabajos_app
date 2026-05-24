import './UpdateAvailable.css';

/**
 * Banner que aparece cuando hay una nueva versión disponible
 */
export default function UpdateAvailable({ onUpdate }) {
  return (
    <div className="update-available-banner">
      <div className="update-content">
        <p className="update-text">
          ✨ Nueva versión disponible
        </p>
        <button className="update-button" onClick={onUpdate}>
          Actualizar
        </button>
      </div>
    </div>
  );
}
