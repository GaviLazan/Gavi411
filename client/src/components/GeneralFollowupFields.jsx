import Input from "./Input";
import Button from "./Button";

// Shared additionalInfo field (G411-21/22/65) — same field/state across
// every follow-up path per the PRD, not per-type. On the GENERAL/"None
// of these" path it's paired with a "Not quite?" control to reveal the
// full type list; RESEARCH/INFO (no dedicated fields of their own, see
// G411-65) reuse this same field but skip that control by omitting
// onPickCategory — they already have a correct match, nothing to redo.
function GeneralFollowupFields({ additionalInfo, onAdditionalInfoChange, onPickCategory }) {
  return (
    <>
      {onPickCategory && (
        <Button variant="secondary" onClick={onPickCategory}>
          Not quite? Pick a category
        </Button>
      )}
      <Input
        label="Anything else I should know?"
        placeholder="Provide any additional details"
        value={additionalInfo}
        onChange={(e) => onAdditionalInfoChange(e.target.value)}
      />
    </>
  );
}

export default GeneralFollowupFields;
