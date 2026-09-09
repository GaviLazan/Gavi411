import { useEffect, useRef, useState } from 'react'
import './HamburgerMenu.css'

// Hamburger navigation menu (G411-95). Slides out from the left,
// triggered by a hamburger icon in the header. Uses native <dialog>
// with a pseudo-modal behavior — click outside or press Escape to close.
// Menu content is provided as props to keep this component focused on
// the open/close/navigation logic.
//
// Close animation: <dialog>.close() hides the element instantly, no
// native support for animating the close itself — the standard pattern
// is a `closing` class that plays the reverse CSS animation, and only
// calling the real .close() once that animation finishes (Gavi's live
// catch: closing had no animation at all, open still played slideIn).
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
      // Real bug hit live (Gavi): the first version of this animation
      // deferred el.close() until the slide-out animation finished
      // (animationend, or a timeout fallback) — but showModal() puts
      // <dialog> in the browser's top layer, which blocks EVERY click
      // on the page behind it for as long as it stays open, animation
      // or not. Any menu click that also changed `view` (i.e. every
      // real navigation, not just backdrop/Escape) left the newly
      // routed screen sitting there un-clickable for that whole
      // close-animation window, with zero console error either way.
      // Fixed: the close itself is bounded to a fixed, short timeout —
      // never gated on an event (animationend) that might not fire —
      // and capped at 150ms specifically so it can never be mistaken
      // for "broken/unresponsive" the way the open-ended version was.
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
      className={`hamburger-menu${closing ? ' hamburger-menu-closing' : ''}`}
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
