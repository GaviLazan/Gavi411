import './Card.css'

// Base card component (G411-17 design foundation).
// White surface, thin border, generous radius — the recurring container
// shape across the Nexus AI screens, the Serviqo stat tiles, and the
// budget-tracker cards in "layout color and elemnts". This is the one
// shape a request/message thread item, a stat tile, and a profile row
// all share, so it's built as a plain wrapper rather than three separate
// components.
// className is merged rather than overwritten (G411-64) — needed once a
// caller (the intake flow's slide-in animation) started passing its own
// modifier class alongside the base "card" look.
function Card({ children, className, ...rest }) {
  return (
    <div className={className ? `card ${className}` : 'card'} {...rest}>
      {children}
    </div>
  )
}

export default Card
