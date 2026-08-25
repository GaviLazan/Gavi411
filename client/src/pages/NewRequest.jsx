import { useState } from "react";
import Card from "../components/Card";
import Input from "../components/Input";
import Button from "../components/Button";
import {
  TravelUrgencyCard,
  TravelDatesCard,
  TravelPreferencesCard,
  TravelBookingsCard,
  EMPTY_TRAVEL_DETAILS,
} from "../components/TravelFields";
import PurchaseFields, { EMPTY_PURCHASE_DETAILS } from "../components/PurchaseFields";
import TechSupportFields, { EMPTY_TECH_SUPPORT_DETAILS } from "../components/TechSupportFields";
import DisambiguationChips from "../components/DisambiguationChips";
import GeneralFollowupFields from "../components/GeneralFollowupFields";
import ReviewSummary from "../components/ReviewSummary";
import ConfirmModal from "../components/ConfirmModal";
import "../components/ReviewSummary.css";
import "./NewRequest.css";

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


// New request intake screen (G411-18/19/21/22/23/65/74, step-machine +
// review screen G411-64). Matching runs once on Continue (not
// live-debounced, per Gavi).
// onDone (G411-67): called after a successful submit's "back to my
// requests" action — was previously a dead end.
function NewRequest({ onDone, onExit, onFreeTextChange }) {
  const [freeText, setFreeTextState] = useState("");
  // Reports freeText up to App.jsx (Gavi's ask: the header logo should
  // also be a working exit control during this flow, not just the
  // in-card "×") — so the logo's click can run the same
  // confirm-if-typed guard without lifting the whole flow's state.
  function setFreeText(value) {
    setFreeTextState(value);
    onFreeTextChange?.(value);
  }
  const [step, setStep] = useState("describe"); // 'describe' | 'chips' | 'fields' | 'review' | 'done'
  const [fieldStepIndex, setFieldStepIndex] = useState(0); // index into the current type's field-card sequence
  const [matchedTypes, setMatchedTypes] = useState([]);
  const [selectedType, setSelectedType] = useState(null); // always a real chip-picked type now (see handleContinue)
  const [pickedChip, setPickedChip] = useState(null); // highlighted-but-not-yet-confirmed chip on the "chips" step
  const [urgency, setUrgency] = useState("NORMAL");
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [showFullTypeList, setShowFullTypeList] = useState(false);
  const [travelDetails, setTravelDetails] = useState(EMPTY_TRAVEL_DETAILS);
  const [purchaseDetails, setPurchaseDetails] = useState(EMPTY_PURCHASE_DETAILS);
  const [techSupportDetails, setTechSupportDetails] = useState(EMPTY_TECH_SUPPORT_DETAILS);
  // Which review rows are unlocked (click-to-edit) — lives here, not in
  // LockedField itself, so it survives review's Card remounting when the
  // friend goes Back into a field card and Continues again (Sibling
  // review finding: a local useState there would silently re-lock).
  const [unlockedKeys, setUnlockedKeys] = useState(() => new Set());
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

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

    // Zero matches still lands on the chip screen (Gavi's call, reversing
    // an earlier decision to skip straight to GENERAL) — but there's
    // nothing to show as a "suggestion," so it goes straight to the same
    // full 5-type list "None of these" already reveals, rather than an
    // empty chip row the friend has to click through.
    setShowFullTypeList(matchedTypes.length === 0);
    setStep("chips");
  }

  // Clicking a chip only highlights it (Gavi's call — click to select,
  // not to advance); confirming needs an explicit Continue.
  function handleChipPick(type) {
    setPickedChip(type);
  }

  function handleChipContinue() {
    setSelectedType(pickedChip);
    setFieldStepIndex(0);
    setStep("fields");
    setShowFullTypeList(false);
    setPickedChip(null);
  }

  function handleChipsBack() {
    setPickedChip(null);
    setShowFullTypeList(false);
    setStep("describe");
  }

  function handleNoneOfThese() {
    // Rejecting real suggestions goes straight to the full type list,
    // not through GENERAL first — re-showing a partial list would be
    // redundant since the friend already said none of it fit. Immediate,
    // not gated behind Continue — it's an escape hatch to a different
    // list, not a type pick to confirm.
    setPickedChip(null);
    setShowFullTypeList(true);
    setStep("chips");
  }

  // typeDetails per selectedType — undefined for RESEARCH/INFO (no
  // dedicated fields), matching the backend's stripEmpty(undefined) ->
  // undefined handling.
  function currentTypeDetails() {
    if (selectedType === "TRAVEL") return travelDetails;
    if (selectedType === "PURCHASE") return purchaseDetails;
    if (selectedType === "TECH_SUPPORT") return techSupportDetails;
    return undefined;
  }

  // TRAVEL is the one type with more than one field-card (G411-64 pickup:
  // dates and preferences checked live at real phone height and don't fit
  // combined, so they stay separate, matching the mockup). Every other
  // type is a single field-card. Building this array fresh per render
  // (not memoized) — it's cheap and keeps the field components simple
  // (they don't need to know they're "step 2 of 4").
  function fieldSteps() {
    if (selectedType === "TRAVEL") {
      return [
        <TravelUrgencyCard
          key="urgency"
          value={travelDetails}
          onChange={setTravelDetails}
          urgency={urgency}
          onUrgencyChange={setUrgency}
          urgencyOptions={URGENCY_OPTIONS}
        />,
        <TravelDatesCard key="dates" value={travelDetails} onChange={setTravelDetails} />,
        <TravelPreferencesCard key="preferences" value={travelDetails} onChange={setTravelDetails} />,
        <TravelBookingsCard key="bookings" value={travelDetails} onChange={setTravelDetails} />,
      ];
    }
    if (selectedType === "PURCHASE") {
      return [
        <PurchaseFields
          key="purchase"
          value={purchaseDetails}
          onChange={setPurchaseDetails}
          urgency={urgency}
          onUrgencyChange={setUrgency}
          urgencyOptions={URGENCY_OPTIONS}
        />,
      ];
    }
    if (selectedType === "TECH_SUPPORT") {
      return [
        <TechSupportFields
          key="tech"
          value={techSupportDetails}
          onChange={setTechSupportDetails}
          urgency={urgency}
          onUrgencyChange={setUrgency}
          urgencyOptions={URGENCY_OPTIONS}
        />,
      ];
    }
    // RESEARCH/INFO (no dedicated fields per PRD) share the same
    // additionalInfo field/state.
    return [
      <GeneralFollowupFields
        key="general"
        additionalInfo={additionalInfo}
        onAdditionalInfoChange={setAdditionalInfo}
        urgency={urgency}
        onUrgencyChange={setUrgency}
        urgencyOptions={URGENCY_OPTIONS}
      />,
    ];
  }

  // Whether the CURRENT field card has any of its own optional content
  // filled in — drives the Continue/Skip label. Urgency is deliberately
  // excluded (it always has a real default, "NORMAL", so it's never
  // truly "empty" the way a blank text field is).
  function currentFieldStepIsEmpty() {
    if (selectedType === "TRAVEL") {
      if (fieldStepIndex === 0) {
        return !travelDetails.whatHappened && !travelDetails.whoContacted && !travelDetails.connectionFlexibility;
      }
      if (fieldStepIndex === 1) {
        return !travelDetails.departureDate && !travelDetails.returnDate && !travelDetails.origin && !travelDetails.destination;
      }
      if (fieldStepIndex === 2) {
        return !travelDetails.preferredAirlines && !travelDetails.layoverPreference && !travelDetails.otherPreferences;
      }
      // card 3: bookings — flights/hotel/car are all opt-in toggles already.
      // A flight added via "+ Add flight" but left entirely blank still
      // counts as empty (Sibling review finding: flights.length === 0
      // alone missed this — an added-but-blank entry made the button
      // read "Continue" despite no real data).
      const hasRealFlight = travelDetails.flights.some((f) => f.airline || f.flightNumber || f.dateTime);
      return !hasRealFlight && !travelDetails.hotel && !travelDetails.car;
    }
    if (selectedType === "PURCHASE") {
      return !purchaseDetails.description && !purchaseDetails.budget && !purchaseDetails.preferences
        && !purchaseDetails.buyWhere && !purchaseDetails.coordination && !purchaseDetails.neededBy && !purchaseDetails.link;
    }
    if (selectedType === "TECH_SUPPORT") {
      return !techSupportDetails.device && !techSupportDetails.issue && !techSupportDetails.triedAlready
        && !techSupportDetails.startedWhen && !techSupportDetails.trigger && !techSupportDetails.helpStyle;
    }
    return !additionalInfo; // RESEARCH/INFO
  }

  function handleFieldStepContinue() {
    const steps = fieldSteps();
    if (fieldStepIndex < steps.length - 1) {
      setFieldStepIndex(fieldStepIndex + 1);
    } else {
      setStep("review");
    }
  }

  function handleFieldStepBack() {
    if (fieldStepIndex > 0) {
      setFieldStepIndex(fieldStepIndex - 1);
      return;
    }
    // Back from the first field-card always returns to chips now — every
    // path (real match, zero match, "None of these") visits "chips" on
    // the way here since zero-match stopped skipping straight to fields
    // (Gavi's call). Re-derive from matchedTypes rather than force false
    // (Sibling review finding on the narrowed-list case) — zero matches
    // has no narrowed list to go back to, so it stays on the full list;
    // a real match narrows back down to its own suggestions.
    setShowFullTypeList(matchedTypes.length === 0);
    setStep("chips");
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
      setStep("done");
    } catch {
      setSubmitError("Something went wrong submitting your request.");
    } finally {
      setSubmitting(false);
    }
  }

  // Only needed on "fields" — ReviewSummary computes its own urgency
  // display/edit control now (click-to-edit-in-place).
  const steps = step === "fields" ? fieldSteps() : null;

  function handleExit() {
    // freeText is the earliest real signal something's been entered —
    // nothing else can be filled in before it's submitted via Continue,
    // since the match call gates every downstream field.
    if (freeText) {
      setShowDiscardConfirm(true);
      return;
    }
    onExit();
  }

  return (
    <div className="step-viewport">
      <Card key={step === "fields" ? `fields-${fieldStepIndex}` : step} className="step-slide-enter">
        {step !== "done" && (
          <button type="button" className="exit-flow" onClick={handleExit} aria-label="Cancel and go back">
            ×
          </button>
        )}
        {step === "describe" && (
          <>
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
            {submitError && <p style={{ color: "#b3261e" }}>{submitError}</p>}
            <Button variant="primary" onClick={handleContinue}>
              Continue
            </Button>
          </>
        )}

        {step === "chips" && (
          <>
            <h2>How can I help?</h2>
            <p>{freeText}</p>
            <DisambiguationChips
              matchedTypes={matchedTypes}
              allTypes={ALL_TYPES}
              typeLabels={TYPE_LABELS}
              showFullTypeList={showFullTypeList}
              pickedType={pickedChip}
              onSelect={handleChipPick}
              onNoneOfThese={handleNoneOfThese}
            />
            <div className="step-nav">
              <Button variant="purple" onClick={handleChipsBack}>
                Back
              </Button>
              <Button variant="primary" onClick={handleChipContinue} disabled={!pickedChip}>
                Continue
              </Button>
            </div>
          </>
        )}

        {step === "fields" && (
          <>
            {/* No standalone "Not quite?" button here (Gavi's call,
                removed this session) — "Back" already reaches chips
                (one card at a time, from card 1 down to chips), so a
                second escape hatch asking "is this the right category?"
                on every single card was redundant and read oddly once
                Back already covers it. */}
            {steps[fieldStepIndex]}
            <div className="step-nav">
              <Button variant="purple" onClick={handleFieldStepBack}>
                Back
              </Button>
              <Button variant="primary" onClick={handleFieldStepContinue}>
                {currentFieldStepIsEmpty() ? "Skip" : "Continue"}
              </Button>
            </div>
          </>
        )}

        {step === "review" && (
          <>
            <h2>Review your request</h2>
            <p className="review-help">click on any field to edit</p>
            <ReviewSummary
              freeText={freeText}
              onFreeTextChange={setFreeText}
              selectedType={selectedType}
              urgency={urgency}
              onUrgencyChange={setUrgency}
              urgencyOptions={URGENCY_OPTIONS}
              additionalInfo={additionalInfo}
              onAdditionalInfoChange={setAdditionalInfo}
              travelDetails={travelDetails}
              onTravelChange={setTravelDetails}
              purchaseDetails={purchaseDetails}
              onPurchaseChange={setPurchaseDetails}
              techSupportDetails={techSupportDetails}
              onTechSupportChange={setTechSupportDetails}
              unlockedKeys={unlockedKeys}
              onUnlock={(key) => setUnlockedKeys((prev) => new Set(prev).add(key))}
            />
            {submitError && <p style={{ color: "#b3261e" }}>{submitError}</p>}
            {/* No separate "Edit" button — every row above is click-to-edit
                in place. No "Not quite?" here either (Gavi's call) — by
                review time the type is treated as settled; that escape
                hatch stays on the field cards only. Back still needed
                (Gavi caught it missing) — returns to the last field
                card, same "one step back" meaning Back has everywhere
                else in this flow. */}
            <div className="step-nav">
              <Button
                variant="purple"
                onClick={() => {
                  setFieldStepIndex(fieldSteps().length - 1);
                  setStep("fields");
                }}
              >
                Back
              </Button>
              <Button variant="success" onClick={handleSubmit} disabled={submitting}>
                {submitting ? "Submitting…" : "Submit"}
              </Button>
            </div>
          </>
        )}

        {step === "done" && submitted && (
          <>
            <p>Thanks — your request is in! Gavi's been notified.</p>
            <Button variant="primary" onClick={onDone}>
              Back to my requests
            </Button>
          </>
        )}
      </Card>
      <ConfirmModal
        open={showDiscardConfirm}
        message="Discard this request?"
        onConfirm={() => {
          setShowDiscardConfirm(false);
          onExit();
        }}
        onCancel={() => setShowDiscardConfirm(false)}
      />
    </div>
  );
}

export default NewRequest;
