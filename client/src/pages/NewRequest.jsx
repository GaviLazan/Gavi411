import { useState } from "react";
import Card from "../components/Card";
import Input from "../components/Input";
import Select from "../components/Select";
import Button from "../components/Button";
import TravelFields, { EMPTY_TRAVEL_DETAILS } from "../components/TravelFields";
import PurchaseFields, { EMPTY_PURCHASE_DETAILS } from "../components/PurchaseFields";
import TechSupportFields, { EMPTY_TECH_SUPPORT_DETAILS } from "../components/TechSupportFields";
import DisambiguationChips from "../components/DisambiguationChips";
import GeneralFollowupFields from "../components/GeneralFollowupFields";

const URGENCY_OPTIONS = [
  { value: "LOW", label: "Low" },
  { value: "NORMAL", label: "Normal" },
  { value: "HIGH", label: "High" },
];

const TYPE_LABELS = {
  TRAVEL: "Travel",
  RESEARCH: "Research",
  PURCHASE: "Purchase",
  TECH_SUPPORT: "Tech Support",
  INFO: "Info",
  GENERAL: "General",
};

// All real types, excluding GENERAL — used for the full-list override
// ("Not quite?" / after "None of these"), since GENERAL is where the
// friend already is in both of those cases, not a pickable escape.
const ALL_TYPES = Object.keys(TYPE_LABELS).filter((t) => t !== "GENERAL");

// New request intake screen (G411-18/19/21/22/23/65). Matching runs
// once on Continue (not live-debounced, per Gavi).
// onDone (G411-67): called after a successful submit's "back to my
// requests" action — was previously a dead end.
function NewRequest({ onDone }) {
  const [freeText, setFreeText] = useState("");
  const [step, setStep] = useState("describe"); // 'describe' | 'chips' | 'followup'
  const [matchedTypes, setMatchedTypes] = useState([]);
  const [selectedType, setSelectedType] = useState(null); // a matched type, or 'NONE'
  const [urgency, setUrgency] = useState("NORMAL");
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [showFullTypeList, setShowFullTypeList] = useState(false);
  const [travelDetails, setTravelDetails] = useState(EMPTY_TRAVEL_DETAILS);
  const [purchaseDetails, setPurchaseDetails] = useState(EMPTY_PURCHASE_DETAILS);
  const [techSupportDetails, setTechSupportDetails] = useState(EMPTY_TECH_SUPPORT_DETAILS);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  async function handleContinue() {
    setSubmitError("");
    const res = await fetch("/api/requests/match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ freeText }),
    });
    if (!res.ok) {
      setSubmitError("Something went wrong matching your request. Try again?");
      return;
    }
    const { matchedTypes } = await res.json();
    setMatchedTypes(matchedTypes);

    if (matchedTypes.length === 0) {
      // Nothing matched — skip chips, land straight on the GENERAL
      // follow-up (a "Not quite?" control there can still reveal the
      // full type list, per Gavi's call).
      setSelectedType("NONE");
      setStep("followup");
    } else {
      setStep("chips");
    }
  }

  function handleChipSelect(type) {
    // type is a matched RequestType, or 'NONE' for "None of these"
    setSelectedType(type);
    setStep("followup");
    setShowFullTypeList(false);
  }

  function handleNoneOfThese() {
    // Rejecting real suggestions goes straight to the full type list,
    // not through GENERAL first — re-showing a partial list would be
    // redundant since the friend already said none of it fit.
    setShowFullTypeList(true);
    setStep("chips");
  }

  // typeDetails per selectedType — undefined for NONE/RESEARCH/INFO,
  // matching the backend's stripEmpty(undefined) -> undefined handling.
  function currentTypeDetails() {
    if (selectedType === "TRAVEL") return travelDetails;
    if (selectedType === "PURCHASE") return purchaseDetails;
    if (selectedType === "TECH_SUPPORT") return techSupportDetails;
    return undefined;
  }

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError("");

    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          freeText,
          type: selectedType,
          urgency,
          additionalInfo,
          typeDetails: currentTypeDetails(),
        }),
      });

      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}));
        setSubmitError(error || "Something went wrong submitting your request.");
        return;
      }

      // Credit deducted, Gavi notified via Telegram — both server-side,
      // nothing to do here beyond showing the confirmation.
      setSubmitted(true);
    } catch {
      setSubmitError("Something went wrong submitting your request.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <h2>How can I help?</h2>

      <Input
        placeholder="Give a short description of what's up"
        value={freeText}
        onChange={(e) => setFreeText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleContinue();
          }
        }}
      />

      {step === "describe" && submitError && (
        <p style={{ color: "#b3261e" }}>{submitError}</p>
      )}

      {step === "describe" && (
        <Button variant="primary" onClick={handleContinue}>
          Continue
        </Button>
      )}

      {step === "chips" && (
        <DisambiguationChips
          matchedTypes={matchedTypes}
          allTypes={ALL_TYPES}
          typeLabels={TYPE_LABELS}
          showFullTypeList={showFullTypeList}
          onSelect={handleChipSelect}
          onNoneOfThese={handleNoneOfThese}
        />
      )}

      {step === "followup" && submitted && (
        <>
          <p>Thanks — your request is in! Gavi's been notified.</p>
          <Button variant="primary" onClick={onDone}>
            Back to my requests
          </Button>
        </>
      )}

      {step === "followup" && !submitted && (
        <>
          {/* A keyword match can be a false positive on any type (e.g.
              "research vacation options" matches RESEARCH on the word
              "research" alone, but is really TRAVEL-shaped) — so every
              followup, matched or not, gets the same way back to the
              full type list, not just the GENERAL/"None of these" path. */}
          <Button
            variant="secondary"
            onClick={() => {
              setShowFullTypeList(true);
              setStep("chips");
            }}
          >
            Not quite? Pick a category
          </Button>

          {selectedType === "TRAVEL" ? (
            <TravelFields value={travelDetails} onChange={setTravelDetails} />
          ) : selectedType === "PURCHASE" ? (
            <PurchaseFields value={purchaseDetails} onChange={setPurchaseDetails} />
          ) : selectedType === "TECH_SUPPORT" ? (
            <TechSupportFields value={techSupportDetails} onChange={setTechSupportDetails} />
          ) : (
            // NONE (zero-match) and RESEARCH/INFO (no dedicated fields
            // per PRD) all share the same additionalInfo field/state.
            <GeneralFollowupFields
              additionalInfo={additionalInfo}
              onAdditionalInfoChange={setAdditionalInfo}
            />
          )}

          <Select
            label="Urgency"
            options={URGENCY_OPTIONS}
            value={urgency}
            onChange={(e) => setUrgency(e.target.value)}
          />

          {submitError && <p style={{ color: "#b3261e" }}>{submitError}</p>}

          <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Submitting…" : "Submit Gavi411 Request"}
          </Button>
        </>
      )}
    </Card>
  );
}

export default NewRequest;
