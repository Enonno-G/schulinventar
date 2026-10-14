// Beschriftetes Formularfeld mit Hinweis und Fehlermeldung
export default function Field({ label, error, hint, className = '', children }) {
  return (
    <label className={`field ${error ? 'has-error' : ''} ${className}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <small className="hint">{hint}</small>}
      {error && <small className="field-error">{error}</small>}
    </label>
  );
}
