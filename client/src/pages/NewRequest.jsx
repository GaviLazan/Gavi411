import { useState } from "react";
import Card from "../components/Card";
import Input from "../components/Input";
import Select from "../components/Select";
import Button from "../components/Button";

const URGENCY_OPTIONS = [
  { value: "LOW", label: "Low" },
  { value: "NORMAL", label: "Normal" },
  { value: "HIGH", label: "High" },
];

// New request intake screen (G411-18).
// Flow (per Gavi, not live-debounced — match runs once on Continue):
//   1. free text -> 2. Continue -> keyword match runs once, renders chips
//   (every candidate type + always a "None of these") -> 3. user picks a
//   chip -> 4. follow-up fields for that type (or generic fallback field
//   if "None of these"), urgency lives in this step for every path ->
//   5. Submit.
// Not this task: matching engine itself (G411-19), disambiguation chip
// UI itself (G411-21), generic fallback field build (G411-22), create
// endpoint + credit deduction (G411-23).
function NewRequest() {
  const [freeText, setFreeText] = useState("");
  const [step, setStep] = useState("describe"); // 'describe' | 'chips' | 'followup'
  const [matchedTypes, setMatchedTypes] = useState([]);
  const [selectedType, setSelectedType] = useState(null); // a matched type, or 'NONE'
  const [urgency, setUrgency] = useState("NORMAL");
  const [fallbackNotes, setFallbackNotes] = useState("");

  function handleContinue() {
    // Call the keyword-matching engine here (G411-19), once, against
    // the full freeText value.
    // setMatchedTypes(...) with whatever it returns, then setStep('chips')
  }

  function handleChipSelect(type) {
    // type is a matched RequestType, or 'NONE' for "None of these"
    setSelectedType(type);
    setStep("followup");
  }

  function handleSubmit() {
    // POST to the request-creation endpoint (G411-23)
    // on success: credit deducted server-side, Gavi notified via Telegram
    // (both server-side concerns, nothing to do here beyond the POST)
  }

  return (
    <Card>
      <h2>How can I help?</h2>

      <Input
        placeholder="Give a short description of what's up"
        value={freeText}
        onChange={(e) => setFreeText(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleContinue()}
      />

      {step === "describe" && (
        <Button variant="primary" onClick={handleContinue}>
          Continue
        </Button>
      )}

      {step === "chips" && (
        <>
          {/* disambiguation chips render here (G411-21) — one per
              matchedTypes entry, plus an always-present "None of these"
              chip that calls handleChipSelect('NONE') */}
        </>
      )}

      {step === "followup" && (
        <>
          {selectedType === "NONE" ? (
            <Input
              label="Anything else I should know?"
              placeholder="Provide any additional details"
              value={fallbackNotes}
              onChange={(e) => setFallbackNotes(e.target.value)}
            />
          ) : (
            <>
              {/* type-specific follow-up fields render here, keyed off selectedType */}
            </>
          )}

          <Select
            label="Urgency"
            options={URGENCY_OPTIONS}
            value={urgency}
            onChange={(e) => setUrgency(e.target.value)}
          />

          <Button variant="primary" onClick={handleSubmit}>
            Submit Gavi411 Request
          </Button>
        </>
      )}
    </Card>
  );
}

export default NewRequest;
