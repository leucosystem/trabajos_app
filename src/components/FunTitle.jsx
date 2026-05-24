import "./FunTitle.css";

/**
 * Titulo decorativo.
 * @param {Object} props
 * @param {string} props.text - Texto a mostrar en el titulo.
 */
export default function FunTitle({ text }) {
  return (
    <h1 className="fun-title">
      <span>{text}</span>
    </h1>
  );
}
