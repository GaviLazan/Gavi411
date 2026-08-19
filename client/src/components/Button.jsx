import './Button.css'

// Base button component (G411-17 design foundation).
// Two variants derived from the inspo:
// - "primary": solid pill button in the accent green — matches the "Get
//   Started" / "Get verification code" pill CTAs seen across General layout
//   and layout-color-and-elemnts.
// - "secondary": outline pill, for lower-emphasis actions (e.g. "Already
//   have an account? Sign In" links styled as buttons, or the profile
//   screen's "Edit Profile" outline pattern).
// variant/type are the only props — extend here if a real need shows up,
// not speculatively.
function Button({ variant = 'primary', type = 'button', children, ...rest }) {
  return (
    <button type={type} className={`btn btn-${variant}`} {...rest}>
      {children}
    </button>
  )
}

export default Button
