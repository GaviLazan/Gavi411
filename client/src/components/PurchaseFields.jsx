import Input from "./Input";
import Select from "./Select";

// PURCHASE-specific follow-up fields (G411-65, regrouped G411-74). All
// optional — prompts to jog memory, not a required intake gate (same
// rule as every other type's follow-up fields). No group headers, just
// <hr> separators.
//
// G411-74 regroup (Gavi's mockup, session 2026-08-25): description,
// urgency, budget, preferred style first; buy-where, pickup/delivery,
// needed-by, link second. Urgency is owned by NewRequest.jsx (shared
// across every type) — passed in as props so it renders inline here
// rather than only at the very end.

const BUY_WHERE_OPTIONS = [
  { value: "", label: "No preference" },
  { value: "ONLINE", label: "Online" },
  { value: "IN_STORE", label: "In store" },
  { value: "BOTH", label: "Either works" },
];

const COORDINATION_OPTIONS = [
  { value: "", label: "Not sure yet" },
  { value: "PICKUP", label: "I'll pick it up" },
  { value: "DELIVERY", label: "Deliver it to me" },
];

// Starting shape for `value` below — exported so NewRequest.jsx can
// seed its useState without duplicating PURCHASE's field list itself.
export const EMPTY_PURCHASE_DETAILS = {
  description: "",
  budget: "",
  preferences: "",
  buyWhere: "",
  coordination: "",
  neededBy: "",
  link: "",
};

function PurchaseFields({ value, onChange, urgency, onUrgencyChange, urgencyOptions }) {
  function set(field, fieldValue) {
    onChange({ ...value, [field]: fieldValue });
  }

  return (
    <>
      <Input
        label="Short description"
        placeholder="What is it?"
        value={value.description}
        onChange={(e) => set("description", e.target.value)}
      />
      <Select
        label="Urgency"
        options={urgencyOptions}
        value={urgency}
        onChange={(e) => onUrgencyChange(e.target.value)}
      />
      <Input
        label="Budget / price range"
        value={value.budget}
        onChange={(e) => set("budget", e.target.value)}
      />
      <Input
        label="Preferred size, color, or model, if it matters"
        value={value.preferences}
        onChange={(e) => set("preferences", e.target.value)}
      />

      <hr />

      <Select
        label="Buy online, in store, or both?"
        options={BUY_WHERE_OPTIONS}
        value={value.buyWhere}
        onChange={(e) => set("buyWhere", e.target.value)}
      />
      <Select
        label="Do you need to coordinate pickup or delivery?"
        options={COORDINATION_OPTIONS}
        value={value.coordination}
        onChange={(e) => set("coordination", e.target.value)}
      />
      <Input
        label="When do you need it by?"
        type="date"
        value={value.neededBy}
        onChange={(e) => set("neededBy", e.target.value)}
      />
      <Input
        label="Link to the item, if you have one"
        type="url"
        value={value.link}
        onChange={(e) => set("link", e.target.value)}
      />
    </>
  );
}

export default PurchaseFields;
