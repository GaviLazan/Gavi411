import Input from "./Input";
import Select from "./Select";

// Shared additionalInfo and urgency fields across all follow-up paths.
function GeneralFollowupFields({ additionalInfo, onAdditionalInfoChange, urgency, onUrgencyChange, urgencyOptions, stepNumber, stepTotal }) {
  return (
    <>
      <h2>Anything else?</h2>
      {stepNumber && stepTotal && <p className="meta">Step {stepNumber} of {stepTotal}</p>}
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
