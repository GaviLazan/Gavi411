import './Chip.css'

// Single selectable chip (G411-21) — used for disambiguation: one chip
// per matched RequestType, plus an always-present "None of these".
// Single-select: clicking a chip picks it, doesn't toggle a multi-select
// set (unlike a typical filter-chip pattern).
function Chip({ selected = false, children, ...rest }) {
  return (
    <button type="button" className={`chip ${selected ? 'chip-selected' : ''}`} {...rest}>
      {children}
    </button>
  )
}

export default Chip
