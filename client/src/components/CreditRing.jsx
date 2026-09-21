import { useEffect, useId, useRef } from 'react'
import './CreditRing.css'

// G411-113 (WP8) — replaces the old "994 credits" app-bar text span, which
// wrapped onto two lines at 390px width and put its detail behind a plain
// title tooltip (invisible on touch, the primary device). Friends only —
// callers must not render this for admin.
const SIZE = 40
const STROKE = 4
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

function CreditRing({ balance, cap }) {
  const popoverId = useId()
  const buttonRef = useRef(null)
  const popoverRef = useRef(null)
  const fraction = cap > 0 ? Math.min(balance / cap, 1) : 0
  const dashoffset = CIRCUMFERENCE * (1 - fraction)

  // CSS Anchor Positioning (anchor-name/position-anchor) isn't supported
  // in Safari yet — positioning via getBoundingClientRect() right before
  // showing works in every browser that supports the base popover
  // attribute at all. Without this, "auto" popovers default to the
  // browser's own top-left placement, not anywhere near their trigger
  // (caught live, Gavi: "the hover text shows in the top left corner").
  // Called once, right after showPopover() — the popover's own layout
  // (and therefore its real width) doesn't exist until it's actually
  // open, so this can't run before that. Positioned off-screen first by
  // the caller so this repositioning happens before the next paint,
  // avoiding a visible jump. Plain left math (no transform) — the
  // earlier centerX + translateX(-50%) version measured its clamp
  // against the post-transform box but still landed off-center in
  // practice (caught live, Gavi: "I would expect it to be more to the
  // left") — computing left directly as centerX - width/2 is the one
  // source of truth for where the box actually sits.
  function positionPopover() {
    const button = buttonRef.current
    const popover = popoverRef.current
    if (!button || !popover) return
    const buttonRect = button.getBoundingClientRect()
    const centerX = buttonRect.left + buttonRect.width / 2
    const width = popover.getBoundingClientRect().width

    const margin = 10
    let left = centerX - width / 2
    left = Math.max(margin, Math.min(left, window.innerWidth - width - margin))

    popover.style.top = `${buttonRect.bottom}px`
    popover.style.left = `${left}px`
  }

  // Driven entirely through the imperative showPopover()/hidePopover() API
  // rather than the declarative popovertarget attribute — the two fought
  // each other (popovertarget's own click-toggle conflicted with the
  // hover-triggered showPopover() calls, so hover silently never opened
  // it — caught live, Gavi: "doesn't pop up on hover, only click").
  //
  // isOpenRef mirrors the popover's real state via its own native
  // "toggle" event (fires on every open/close, from any cause) rather
  // than being set only inside openPopover()/closePopover() — those two
  // functions are the only ones that ever call show/hidePopover(), but
  // the browser can also close an "auto" popover on its own (Escape,
  // clicking outside) with no call through this component at all. An
  // isOpenRef set only by our own calls went stale after a native
  // light-dismiss: the ref still said "open" while the popover was
  // actually closed, so the next hover/click silently no-op'd instead of
  // reopening it. Sibling review finding.
  const isOpenRef = useRef(false)
  useEffect(() => {
    const popover = popoverRef.current
    if (!popover) return
    function handleToggle(e) {
      isOpenRef.current = e.newState === 'open'
    }
    popover.addEventListener('toggle', handleToggle)
    return () => popover.removeEventListener('toggle', handleToggle)
  }, [])
  function openPopover() {
    if (isOpenRef.current) return
    const popover = popoverRef.current
    if (!popover) return
    // Positioned off-screen before it's shown, then moved to its real
    // spot immediately after — both happen before the browser paints,
    // so there's no visible jump from -9999px to the real position.
    popover.style.position = 'fixed'
    popover.style.top = '-9999px'
    popover.style.left = '-9999px'
    popover.showPopover?.()
    positionPopover()
  }
  function closePopover() {
    if (!isOpenRef.current) return
    popoverRef.current?.hidePopover?.()
  }
  function toggleOnClick() {
    if (isOpenRef.current) closePopover()
    else openPopover()
  }

  const now = new Date()
  // Resets always land at the start of a calendar month (the 6-hourly
  // reset job just fires sometime within that day) — "Month 1st" is
  // accurate without implying a precision the job doesn't have. Same calc
  // previously inlined in App.jsx's tooltip (G411-51).
  const resetMonth = now.getDate() === 1
    ? now.toLocaleDateString('en-US', { month: 'long' })
    : new Date(now.getFullYear(), now.getMonth() + 1, 1).toLocaleDateString('en-US', { month: 'long' })
  const detailLabel = `${balance} of ${cap} favors left. Resets ${resetMonth} 1st`

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="credit-ring"
        aria-label={detailLabel}
        aria-describedby={popoverId}
        onMouseEnter={openPopover}
        onMouseLeave={closePopover}
        onClick={toggleOnClick}
      >
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="var(--border)"
            strokeWidth={STROKE}
          />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashoffset}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          />
        </svg>
        <span className="credit-ring-number" aria-hidden="true">{balance}</span>
      </button>
      <div ref={popoverRef} id={popoverId} popover="auto" className="credit-ring-popover">
        <span>{balance} of {cap} favors left</span>
        <span>Resets {resetMonth} 1st</span>
      </div>
    </>
  )
}

export default CreditRing
