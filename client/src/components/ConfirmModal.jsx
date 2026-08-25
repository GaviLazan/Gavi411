import { useEffect, useRef } from "react";
import Button from "./Button";
import "./ConfirmModal.css";

// Shared discard/confirm modal (G411-64) — replaces the native
// confirm()/OS popup for "Discard this request?", which read as an ugly
// browser chrome moment inside an otherwise fully custom-styled flow.
// Native <dialog> (ponytail: no library needed) — free focus trap,
// Escape-to-close, and backdrop via ::backdrop.
function ConfirmModal({ open, message, onConfirm, onCancel }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  // onCancel only, not onClose: native <dialog> doesn't close on backdrop
  // click by default (that needs manual JS this modal doesn't add), so
  // Escape's "cancel" event is the only close path that isn't already a
  // button click. onClose also fires after the effect above calls
  // el.close() following a real onConfirm click, which made onConfirm
  // and onCancel both run on every confirmed "Yes" (Sibling review
  // finding) — dropped.
  return (
    <dialog ref={ref} className="confirm-modal" onCancel={onCancel}>
      <p>{message}</p>
      <div className="step-nav">
        <Button variant="purple" onClick={onCancel}>
          No
        </Button>
        <Button variant="primary" onClick={onConfirm}>
          Yes
        </Button>
      </div>
    </dialog>
  );
}

export default ConfirmModal;
