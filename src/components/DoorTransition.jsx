import './DoorTransition.css';

export default function DoorTransition({ isOpen }) {
  return (
    <div className={`door-transition ${isOpen ? 'opening' : ''}`} aria-hidden="true">
      <div className="door door-left"></div>
      <div className="door door-right"></div>
    </div>
  );
}
