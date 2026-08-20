import './Input.css'

// Base text input (G411-17 design foundation).
// Pill-shaped, matches the "Mobile number" / "Ask anything..." / "Search
// conversations..." inputs repeated across General layout and elements
// style. Optional label goes above, matching the Edit Profile form pattern
// (label text, then field) rather than a floating label — simplest option
// that matches the reference.
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
