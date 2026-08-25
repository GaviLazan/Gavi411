import Input from "./Input";
import Select from "./Select";
import "./LockedField.css";

// One row on the review screen (G411-64) — starts "locked" (read-only,
// review-row styling, light outline showing it's clickable), unlocks
// into a real editable control on click. Each row unlocks independently
// (no accordion, no re-lock on blur — stays editable until submit, per
// Gavi's call). type: "text" | "date" | "select" | "checkbox" — matches
// what the underlying field actually is, not a generic text box for
// everything.
//
// unlocked/onUnlock are lifted to NewRequest (Sibling review finding) —
// this component navigating Back into a field card and Continue-ing
// back to review remounts the whole review Card (different step keys
// in between), which would silently reset a locally-owned `unlocked`
// useState and contradict the "stays editable until submit" promise.
function LockedField({ label, value, onChange, type = "text", options, checked, id, unlocked, onUnlock }) {

  // For select fields, show the human label ("High") not the raw
  // stored value ("HIGH") while locked — same lookup Select.jsx already
  // does internally for its own <option> rendering.
  const displayValue = type === "select" ? options?.find((o) => o.value === value)?.label ?? value : value;

  if (unlocked) {
    if (type === "select") {
      return <Select label={label} id={id} options={options} value={value} onChange={onChange} />;
    }
    if (type === "checkbox") {
      return (
        <label className="locked-field-checkbox">
          <input type="checkbox" checked={checked} onChange={onChange} />
          {label}
        </label>
      );
    }
    return <Input label={label} id={id} type={type} value={value} onChange={onChange} />;
  }

  return (
    <button
      type="button"
      className="locked-field"
      onClick={onUnlock}
    >
      <span className="review-label">{label}</span>
      <span className="review-value" dir="auto">{displayValue || "—"}</span>
    </button>
  );
}

export default LockedField;
