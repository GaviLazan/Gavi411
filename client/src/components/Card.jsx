import './Card.css'

// Base card container: white surface, thin border, generous radius.
// className is merged rather than overwritten — callers may pass additional modifier classes.
function Card({ children, className, ...rest }) {
  return (
    <div className={className ? `card ${className}` : 'card'} {...rest}>
      {children}
    </div>
  )
}

export default Card
