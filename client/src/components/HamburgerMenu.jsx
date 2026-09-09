import { useEffect, useRef } from 'react'
import './HamburgerMenu.css'

// Hamburger navigation menu (G411-95). Slides out from the left,
// triggered by a hamburger icon in the header. Uses native <dialog>
// with a pseudo-modal behavior — click outside or press Escape to close.
// Menu content is provided as props to keep this component focused on
// the open/close/navigation logic.
function HamburgerMenu({ open, onClose, children }) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])

  // Handle backdrop click (click outside the menu content area)
  function handleBackdropClick(e) {
    if (e.target === ref.current) {
      onClose()
    }
  }

  // Handle Escape key (native dialog cancels on Escape)
  function handleCancel(e) {
    e.preventDefault()
    onClose()
  }

  return (
    <dialog
      ref={ref}
      className="hamburger-menu"
      onCancel={handleCancel}
      onClick={handleBackdropClick}
    >
      <div className="hamburger-menu-content">
        {children}
      </div>
    </dialog>
  )
}

export default HamburgerMenu
