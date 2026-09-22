import './Input.css'

// Base text input: pill-shaped with optional label above.
function Input({ label, id, ...rest }) {
  return (
    <div className="field">
      {label && (
        <label className="field-label" htmlFor={id}>
          {label}
        </label>
      )}
      <input id={id} dir="auto" className="field-input" {...rest} />
    </div>
  )
}

export default Input
