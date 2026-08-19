import './Card.css'

// Base card component (G411-17 design foundation).
// White surface, thin border, generous radius — the recurring container
// shape across the Nexus AI screens, the Serviqo stat tiles, and the
// budget-tracker cards in "layout color and elemnts". This is the one
// shape a request/message thread item, a stat tile, and a profile row
// all share, so it's built as a plain wrapper rather than three separate
// components.
function Card({ children, ...rest }) {
  return (
    <div className="card" {...rest}>
      {children}
    </div>
  )
}

export default Card
