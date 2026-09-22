import './Chip.css'

// Single-select chip: clicking picks it, doesn't toggle a multi-select set.
function Chip({ selected = false, children, ...rest }) {
  return (
    <button type="button" className={`chip ${selected ? 'chip-selected' : ''}`} {...rest}>
      {children}
    </button>
  )
}

export default Chip
