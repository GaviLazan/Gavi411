import { useEffect, useRef, useState } from 'react'
import Button from './Button'
import Icon from './Icon'
import './HamburgerMenu.css'

// Hamburger navigation menu: native <dialog> sliding in from the left.
// Close animation: CSS class triggers slideOut, then .close() after 150ms.
function HamburgerMenu({ open, onClose, children }) {
  const ref = useRef(null)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open) {
      setClosing(false)
      if (!el.open) el.showModal()
    } else if (el.open) {
      // Use fixed 150ms timeout for close (never wait on animationend).
      // Keep in sync with HamburgerMenu.css's slideOut duration.
      setClosing(true)
      const timeout = setTimeout(() => {
        el.close()
        setClosing(false)
      }, 150)
      return () => clearTimeout(timeout)
    }
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
      id="app-menu"
      aria-label="Menu"
      className={`hamburger-menu${closing ? ' hamburger-menu-closing' : ''}`}
      onCancel={handleCancel}
      onClick={handleBackdropClick}
    >
      <div className="hamburger-menu-content">
        <Button variant="icon" onClick={onClose} aria-label="Close menu" className="hamburger-menu-close">
          <Icon name="close" />
        </Button>
        {children}
      </div>
    </dialog>
  )
}

export default HamburgerMenu
