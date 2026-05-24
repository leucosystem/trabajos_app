import { useState } from 'react';
import './Auth.css';

function toFriendlyAuthError(err, isSignUp) {
  const raw = err?.message || '';
  const normalized = raw.toLowerCase();

  if (normalized.includes('invalid login credentials')) {
    return 'Email o contraseña incorrectos. Revisa los datos e intentalo de nuevo.';
  }

  if (normalized.includes('email not confirmed')) {
    return 'Tu email aun no esta confirmado.';
  }

  if (normalized.includes('user already registered')) {
    return 'Ese email ya esta registrado. Prueba iniciar sesion.';
  }

  return raw || (isSignUp ? 'No se pudo completar el registro.' : 'No se pudo iniciar sesion.');
}

export default function Auth({ onSignUp, onSignIn, loading }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState(null);
  const [messageType, setMessageType] = useState('error');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setMessageType('error');

    if (!email || !password) {
      setError('Email y contraseña son requeridos');
      return;
    }

    if (isSignUp && !fullName) {
      setError('El nombre es requerido para registrarse');
      return;
    }

    try {
      if (isSignUp) {
        const { error } = await onSignUp(email, password, fullName);
        if (error) {
          setMessageType('error');
          setError(toFriendlyAuthError(error, true));
        } else {
          setEmail('');
          setPassword('');
          setFullName('');
          setMessageType('success');
          setError('¡Registrado! Ahora inicia sesión');
        }
      } else {
        const { error } = await onSignIn(email, password);
        if (error) {
          setMessageType('error');
          setError(toFriendlyAuthError(error, false));
        }
      }
    } catch (err) {
      setMessageType('error');
      setError(toFriendlyAuthError(err, isSignUp));
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h1>{isSignUp ? 'Nuevo Usuario' : 'Control de Acceso'}</h1>
        <p className="auth-subtitle">Registro de Trabajos</p>

        <form onSubmit={handleSubmit}>
          {isSignUp && (
            <div className="form-group">
              <label>Nombre Completo</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Tu nombre"
                disabled={loading}
              />
            </div>
          )}

          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="correo@ejemplo.com"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label>Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={loading}
            />
          </div>

          {error && <div className={`message ${messageType}`}>{error}</div>}

          <button type="submit" disabled={loading}>
            {loading ? 'Cargando...' : isSignUp ? 'Registrarse' : 'Inicia Sesión'}
          </button>
        </form>

        <p className="toggle-form">
          {isSignUp ? '¿Ya tienes cuenta? ' : '¿No tienes cuenta? '}
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
              setMessageType('error');
            }}
            disabled={loading}
            className="link-btn"
          >
            {isSignUp ? 'Inicia Sesión' : 'Registrarse'}
          </button>
        </p>
      </div>
    </div>
  );
}
