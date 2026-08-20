import './Select.css'

// Base select (matches Input.jsx's field pattern/styling — same
// pill shape, border, focus ring — for dropdown-shaped choices instead
// of freeform text).
function Select({ label, id, options, ...rest }) {
  return (
    <div className="field">
      {label && (
        <label className="field-label" htmlFor={id}>
          {label}
        </label>
      )}
      <select id={id} className="field-select" {...rest}>
        {options.map(({ value, label: optionLabel }) => (
          <option key={value} value={value}>
            {optionLabel}
          </option>
        ))}
      </select>
    </div>
  )
}

export default Select
