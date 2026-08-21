import Input from "./Input";
import Button from "./Button";

// Fields for the GENERAL/"None of these" path (G411-21/22): the shared
// additionalInfo field, plus a "Not quite?" control to reveal the full
// type list so the friend can still pick a specific category without
// losing what they've typed (additionalInfo is shared state, not
// per-type — see G411-21).
function GeneralFollowupFields({ additionalInfo, onAdditionalInfoChange, onPickCategory }) {
  return (
    <>
      <Button variant="secondary" onClick={onPickCategory}>
        Not quite? Pick a category
      </Button>
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
