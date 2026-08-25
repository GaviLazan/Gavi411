import Input from "./Input";
import Select from "./Select";

// Shared additionalInfo field (G411-21/22/65) — same field/state across
// every follow-up path per the PRD, not per-type. The "Not quite? Pick
// a category" control used to live here, but a keyword match can be a
// false positive on ANY type (e.g. "research vacation options" matches
// RESEARCH on the word "research" alone, but is really TRAVEL-shaped) —
// so that control now lives in NewRequest.jsx, wrapping every followup
// branch identically instead of just this one.
//
// G411-64: this is its own sliding card now (NONE/RESEARCH/INFO all
// share it), so urgency joins it rather than falling back to a shared
// global field outside any card.
function GeneralFollowupFields({ additionalInfo, onAdditionalInfoChange, urgency, onUrgencyChange, urgencyOptions }) {
  return (
    <>
      <Input
        label="Anything else I should know?"
        placeholder="Provide any additional details"
        value={additionalInfo}
        onChange={(e) => onAdditionalInfoChange(e.target.value)}
      />
      <Select
        label="Urgency"
        options={urgencyOptions}
        value={urgency}
        onChange={(e) => onUrgencyChange(e.target.value)}
      />
    </>
  );
}

export default GeneralFollowupFields;
