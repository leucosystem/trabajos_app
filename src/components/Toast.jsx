import { useEffect } from "react";
import "./Toast.css";

/**
 * Notificacion temporal que se muestra y desaparece sola.
 * @param {Object} props
 * @param {string} props.message - Texto a mostrar.
 * @param {"success"|"error"} props.type - Tipo visual del toast.
 * @param {function} props.onClose - Callback al cerrarse.
 */
export default function Toast({ message, type = "success", onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`toast toast--${type}`} role="alert">
      {message}
    </div>
  );
}
