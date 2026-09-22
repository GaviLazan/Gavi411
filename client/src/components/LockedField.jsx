import Input from "./Input";
import Select from "./Select";
import Icon from "./Icon";
import { formatDate } from "../lib/format";
import "./LockedField.css";

// Review screen row: locked (read-only) until clicked, then editable inline.
// unlocked state is lifted to NewRequest to survive card remounts.
function LockedField({ label, value, onChange, type = "text", options, checked, id, unlocked, onUnlock }) {

  // For select fields, show the human label ("High") not the raw
  // stored value ("HIGH") while locked — same lookup Select.jsx already
  // does internally for its own <option> rendering.
  let displayValue = type === "select" ? options?.find((o) => o.value === value)?.label ?? value : value;
  // For date fields, format the ISO date to a readable format
  if (type === "date" && value) {
    displayValue = formatDate(value);
  }

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
      <div className="locked-field-content">
        <div>
          <span className="review-label">{label}</span>
          <span className="review-value" dir="auto">{displayValue || "—"}</span>
        </div>
        <Icon name="edit" size={18} />
      </div>
    </button>
  );
}

export default LockedField;
