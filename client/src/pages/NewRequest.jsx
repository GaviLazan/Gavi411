import { useState } from "react";
import Card from "../components/Card";
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
import { RequestCard } from "./RequestCard";
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

const ALL_TYPES = Object.keys(TYPE_LABELS).filter((t) => t !== "GENERAL");

// ── State ──
function NewRequest({ onDone, onExit, onFreeTextChange, isOnline }) {
  const [freeText, setFreeTextState] = useState("");
  function setFreeText(value) {
    setFreeTextState(value);
    onFreeTextChange?.(value);
  }
  const [step, setStep] = useState("describe");
  const [fieldStepIndex, setFieldStepIndex] = useState(0);
  const [matchedTypes, setMatchedTypes] = useState([]);
  const [selectedType, setSelectedType] = useState(null);
  const [pickedChip, setPickedChip] = useState(null);
  const [urgency, setUrgency] = useState("NORMAL");
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [showFullTypeList, setShowFullTypeList] = useState(false);
  const [travelDetails, setTravelDetails] = useState(EMPTY_TRAVEL_DETAILS);
  const [purchaseDetails, setPurchaseDetails] = useState(EMPTY_PURCHASE_DETAILS);
  const [techSupportDetails, setTechSupportDetails] = useState(EMPTY_TECH_SUPPORT_DETAILS);
  const [unlockedKeys, setUnlockedKeys] = useState(() => new Set());
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [createdRequest, setCreatedRequest] = useState(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [overdraftEligible, setOverdraftEligible] = useState(false);
  const [overdraftPending, setOverdraftPending] = useState(false);

  // ── Handlers ──
  async function handleContinue() {
    setSubmitError("");
    const res = await fetch("/api/requests/match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ freeText }),
    });
    if (!res.ok) {
      setSubmitError("Something went wrong figuring out what you need help with. Try again?");
      return;
    }
    const { matchedTypes } = await res.json();
    setMatchedTypes(matchedTypes);

    setShowFullTypeList(matchedTypes.length === 0);
    setStep("chips");
  }

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
    setPickedChip(null);
    setShowFullTypeList(true);
    setStep("chips");
  }

  function currentTypeDetails() {
    if (selectedType === "TRAVEL") return travelDetails;
    if (selectedType === "PURCHASE") return purchaseDetails;
    if (selectedType === "TECH_SUPPORT") return techSupportDetails;
    return undefined;
  }

  function fieldSteps() {
    if (selectedType === "TRAVEL") {
      const steps = [
        <TravelUrgencyCard
          key="urgency"
          value={travelDetails}
          onChange={setTravelDetails}
          urgency={urgency}
          onUrgencyChange={setUrgency}
          urgencyOptions={URGENCY_OPTIONS}
          stepNumber={1}
          stepTotal={4}
        />,
        <TravelDatesCard key="dates" value={travelDetails} onChange={setTravelDetails} stepNumber={2} stepTotal={4} />,
        <TravelPreferencesCard key="preferences" value={travelDetails} onChange={setTravelDetails} stepNumber={3} stepTotal={4} />,
        <TravelBookingsCard key="bookings" value={travelDetails} onChange={setTravelDetails} stepNumber={4} stepTotal={4} />,
      ];
      return steps;
    }
    if (selectedType === "PURCHASE") {
      const steps = [
        <PurchaseFields
          key="purchase"
          value={purchaseDetails}
          onChange={setPurchaseDetails}
          urgency={urgency}
          onUrgencyChange={setUrgency}
          urgencyOptions={URGENCY_OPTIONS}
          stepNumber={1}
          stepTotal={1}
        />,
      ];
      return steps;
    }
    if (selectedType === "TECH_SUPPORT") {
      const steps = [
        <TechSupportFields
          key="tech"
          value={techSupportDetails}
          onChange={setTechSupportDetails}
          urgency={urgency}
          onUrgencyChange={setUrgency}
          urgencyOptions={URGENCY_OPTIONS}
          stepNumber={1}
          stepTotal={1}
        />,
      ];
      return steps;
    }
    const steps = [
      <GeneralFollowupFields
        key="general"
        additionalInfo={additionalInfo}
        onAdditionalInfoChange={setAdditionalInfo}
        urgency={urgency}
        onUrgencyChange={setUrgency}
        urgencyOptions={URGENCY_OPTIONS}
        stepNumber={1}
        stepTotal={1}
      />,
    ];
    return steps;
  }

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
    setShowFullTypeList(matchedTypes.length === 0);
    setStep("chips");
  }

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError("");
    setOverdraftEligible(false);

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
        setSubmitError(error || "Something went wrong sending this. Try again?");
        if (res.status === 402) setOverdraftEligible(true);
        return;
      }

      const created = await res.json();
      setCreatedRequest(created);
      setSubmitted(true);
      setStep("done");
      onFreeTextChange?.("");
    } catch {
      setSubmitError("Something went wrong sending this. Try again?");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleOverdraftRequest() {
    setSubmitting(true);
    setSubmitError("");

    try {
      const res = await fetch("/api/requests/overdraft-request", {
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
        setSubmitError(error || "Something went wrong sending that. Try again?");
        return;
      }

      const created = await res.json();
      setCreatedRequest(created);
      setOverdraftEligible(false);
      setOverdraftPending(true);
      setStep("done");
    } catch {
      setSubmitError("Something went wrong sending that. Try again?");
    } finally {
      setSubmitting(false);
    }
  }

  const steps = step === "fields" ? fieldSteps() : null;

  function handleExit() {
    if (freeText) {
      setShowDiscardConfirm(true);
      return;
    }
    onExit();
  }

  // ── Render ──
  return (
    <div className="step-viewport">
      <Card key={step === "fields" ? `fields-${fieldStepIndex}` : step} className="step-slide-enter">
        {step === "describe" && (
          <>
            <h2>How can I help?</h2>
            <textarea
              className="field-input describe-textarea"
              placeholder="Give a short description of what's up"
              rows={2}
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              onInput={(e) => {
                e.target.style.height = "auto";
                e.target.style.height = `${e.target.scrollHeight}px`;
              }}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                if (e.shiftKey) return; // native newline
                if (e.ctrlKey || e.metaKey) {
                  // Same as RequestDetail.jsx's message compose box: a
                  // textarea's native un-prevented default for a MODIFIED
                  // Enter is nothing, not a newline, so this inserts one
                  // explicitly.
                  e.preventDefault();
                  const el = e.target;
                  const start = el.selectionStart;
                  const end = el.selectionEnd;
                  const next = freeText.slice(0, start) + "\n" + freeText.slice(end);
                  setFreeText(next);
                  requestAnimationFrame(() => {
                    el.selectionStart = el.selectionEnd = start + 1;
                  });
                  return;
                }
                e.preventDefault();
                handleContinue();
              }}
              dir="auto"
            />
            <button type="button" className="exit-flow" onClick={handleExit} aria-label="Cancel and go back">
              ×
            </button>
            {submitError && <p style={{ color: "#b3261e" }}>{submitError}</p>}
            <Button variant="primary" onClick={handleContinue}>
              Continue
            </Button>
          </>
        )}

        {step !== "describe" && step !== "done" && (
          <button type="button" className="exit-flow" onClick={handleExit} aria-label="Cancel and go back">
            ×
          </button>
        )}

        {step === "chips" && (
          <>
            <h2>How can I help?</h2>
            <p>{freeText}</p>
            <p className="meta">
              {showFullTypeList
                ? "Didn't quite catch what kind of ask this is — pick one:"
                : "Which one of these request types is closest?"}
            </p>
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
              <Button variant="ghost" onClick={handleChipsBack}>
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
            {steps[fieldStepIndex]}
            <div className="step-nav">
              <Button variant="ghost" onClick={handleFieldStepBack}>
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
            {overdraftEligible && (
              <Button variant="secondary" onClick={handleOverdraftRequest} disabled={submitting}>
                {submitting ? "Sending…" : "Ask anyway"}
              </Button>
            )}
            <div className="step-nav">
              <Button
                variant="ghost"
                onClick={() => {
                  setFieldStepIndex(fieldSteps().length - 1);
                  setStep("fields");
                }}
              >
                Back
              </Button>
              <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
                {submitting ? "Submitting…" : "Submit"}
              </Button>
            </div>
          </>
        )}

        {step === "done" && submitted && createdRequest && (
          <>
            <h2>Sent!</h2>
            <RequestCard request={createdRequest} showStatusChip onClick={() => onDone(createdRequest.id)} />
            <p className="meta">{isOnline ? "Sent to Gavi" : "Sent to Gavi — responses might be a little slow"}</p>
            <div className="step-nav">
              <Button variant="ghost" onClick={() => onDone()}>
                Back home
              </Button>
              <Button variant="primary" onClick={() => onDone(createdRequest.id)}>
                Open it
              </Button>
            </div>
          </>
        )}

        {step === "done" && overdraftPending && createdRequest && (
          <>
            <h2>Sent!</h2>
            <RequestCard request={createdRequest} showStatusChip onClick={() => onDone(createdRequest.id)} />
            <p className="meta">Gavi will take a look and let you know if it's approved.</p>
            <div className="step-nav">
              <Button variant="ghost" onClick={() => onDone()}>
                Back home
              </Button>
              <Button variant="primary" onClick={() => onDone(createdRequest.id)}>
                Open it
              </Button>
            </div>
          </>
        )}
      </Card>
      <ConfirmModal
        open={showDiscardConfirm}
        message="Discard this?"
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
