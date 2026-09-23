import { useEffect, useRef } from "react";
import Button from "./Button";
import "./ConfirmModal.css";

// Discard/confirm modal using native <dialog>.
// ponytail: no library needed — free focus trap, Escape-to-close, backdrop via ::backdrop.
function ConfirmModal({ open, message, onConfirm, onCancel, busy }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  // onCancel only, not onClose: native <dialog> doesn't close on backdrop
  // click by default, so Escape's "cancel" event is the only close path.
  //
  // preventDefault while busy: Escape should not dismiss the modal while
  // onConfirm's request is in flight.
  function handleNativeCancel(e) {
    if (busy) {
      e.preventDefault();
      return;
    }
    onCancel();
  }

  return (
    <dialog ref={ref} className="confirm-modal" onCancel={handleNativeCancel}>
      <p>{message}</p>
      <div className="step-nav">
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          No
        </Button>
        {/* busy prevents double-fire on rapid clicks */}
        <Button variant="primary" onClick={onConfirm} disabled={busy}>
          Yes
        </Button>
      </div>
    </dialog>
  );
}

export default ConfirmModal;
