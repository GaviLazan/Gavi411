import './Button.css'

// Base button component with two variants: primary (solid) and secondary (outline).
// variant/type are the only props — extend if a real need shows up, not speculatively.
function Button({ variant = 'primary', type = 'button', className, children, ...rest }) {
  return (
    <button type={type} className={`btn btn-${variant}${className ? ` ${className}` : ''}`} {...rest}>
      {children}
    </button>
  )
}

export default Button
