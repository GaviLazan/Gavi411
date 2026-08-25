import LockedField from "./LockedField";
import { BUY_WHERE_OPTIONS, COORDINATION_OPTIONS } from "./PurchaseFields";
import { HELP_STYLE_OPTIONS } from "./TechSupportFields";

// Review/summary screen (G411-64, click-to-edit-in-place per Gavi's
// live steer). Every non-empty field the friend entered renders as a
// LockedField — starts read-only, unlocks into the real control (text/
// date/select/checkbox) on click, independently per row, no re-lock.
//
// Field specs (key, label, type, options) are the one source of truth
// for both what's shown and what's editable — a plain label map isn't
// enough anymore once rows need to become real inputs matching their
// actual field type, not just display text.
//
// unlockedKeys/onUnlock (Sibling review finding): unlocked state lives
// in NewRequest, not locally in LockedField — navigating Back into a
// field card and Continue-ing back to review remounts this whole
// component (different step keys in between), which would otherwise
// silently re-lock every field, contradicting "stays editable until
// submit".

const TRAVEL_SPECS = [
  { key: "whatHappened", label: "What happened" },
  { key: "whoContacted", label: "Who you've contacted" },
  { key: "connectionFlexibility", label: "Connections / arrival flexibility" },
  { key: "departureDate", label: "Departure date", type: "date" },
  { key: "returnDate", label: "Return date", type: "date" },
  { key: "origin", label: "Origin" },
  { key: "destination", label: "Destination" },
  { key: "preferredAirlines", label: "Preferred airline(s)" },
  { key: "layoverPreference", label: "Layover preference" },
  { key: "otherPreferences", label: "Other preferences" },
  // bookingNumber is intentionally NOT a plain LockedField (Sibling
  // review finding) — TravelBookingsCard gates it behind a required
  // bookingNumberConsent checkbox and clears it whenever consent is
  // unchecked; editing it here without the same gate would let the
  // value and the consent flag go out of sync. Rendered as its own
  // consent-aware row below instead of via specRows/TRAVEL_SPECS.
];

const HOTEL_CAR_SPECS = [
  { key: "date", label: "Dates" },
  { key: "location", label: "Location" },
  { key: "company", label: "Company" },
  { key: "ref", label: "Reference number" },
];

const PURCHASE_SPECS = [
  { key: "description", label: "Description" },
  { key: "budget", label: "Budget / price range" },
  { key: "preferences", label: "Preferred size, color, or model" },
  { key: "buyWhere", label: "Buy online, in store, or both", type: "select", options: BUY_WHERE_OPTIONS },
  { key: "coordination", label: "Pickup or delivery", type: "select", options: COORDINATION_OPTIONS },
  { key: "neededBy", label: "Needed by", type: "date" },
  { key: "link", label: "Item link" },
];

const TECH_SUPPORT_SPECS = [
  { key: "device", label: "Device / platform" },
  { key: "issue", label: "The issue" },
  { key: "triedAlready", label: "Already tried" },
  { key: "startedWhen", label: "Started when" },
  { key: "trigger", label: "Happens after" },
  { key: "helpStyle", label: "Preferred help style", type: "select", options: HELP_STYLE_OPTIONS },
];

// Renders one LockedField per non-empty spec — every spec whose field
// is currently empty is skipped (matches the old "only show what was
// filled" behavior).
function specRows(specs, details, set, unlockedKeys, onUnlock, keyPrefix = "", labelPrefix = "") {
  return specs
    .filter(({ key }) => details[key])
    .map(({ key, label, type, options }) => {
      const rowKey = keyPrefix + key;
      return (
        <LockedField
          key={rowKey}
          label={labelPrefix + label}
          type={type}
          options={options}
          value={details[key]}
          checked={type === "checkbox" ? details[key] : undefined}
          onChange={(e) => set(key, type === "checkbox" ? e.target.checked : e.target.value)}
          unlocked={unlockedKeys.has(rowKey)}
          onUnlock={() => onUnlock(rowKey)}
        />
      );
    });
}

function ReviewSummary({
  freeText,
  onFreeTextChange,
  selectedType,
  urgency,
  onUrgencyChange,
  urgencyOptions,
  additionalInfo,
  onAdditionalInfoChange,
  travelDetails,
  onTravelChange,
  purchaseDetails,
  onPurchaseChange,
  techSupportDetails,
  onTechSupportChange,
  unlockedKeys,
  onUnlock,
}) {
  function setTravel(key, value) {
    onTravelChange({ ...travelDetails, [key]: value });
  }
  function setTravelHotel(key, value) {
    onTravelChange({ ...travelDetails, hotel: { ...travelDetails.hotel, [key]: value } });
  }
  function setTravelCar(key, value) {
    onTravelChange({ ...travelDetails, car: { ...travelDetails.car, [key]: value } });
  }
  function setPurchase(key, value) {
    onPurchaseChange({ ...purchaseDetails, [key]: value });
  }
  function setTechSupport(key, value) {
    onTechSupportChange({ ...techSupportDetails, [key]: value });
  }

  let rows = [];
  if (selectedType === "TRAVEL") {
    rows = specRows(TRAVEL_SPECS, travelDetails, setTravel, unlockedKeys, onUnlock);
    if (travelDetails.hotel) {
      rows = rows.concat(specRows(HOTEL_CAR_SPECS, travelDetails.hotel, setTravelHotel, unlockedKeys, onUnlock, "hotel-", "Hotel — "));
    }
    if (travelDetails.car) {
      rows = rows.concat(specRows(HOTEL_CAR_SPECS, travelDetails.car, setTravelCar, unlockedKeys, onUnlock, "car-", "Rental car — "));
    }
    // bookingNumber: consent-aware row, not a plain LockedField (see
    // TRAVEL_SPECS comment above) — editing it here keeps consent=true
    // implicitly (it can only be non-empty if consent was already given
    // in TravelBookingsCard), and clearing it back to empty here also
    // clears consent, mirroring TravelBookingsCard's own guard exactly.
    if (travelDetails.bookingNumber) {
      rows.push(
        <LockedField
          key="bookingNumber"
          label="Booking number"
          value={travelDetails.bookingNumber}
          onChange={(e) => {
            const next = e.target.value;
            onTravelChange({ ...travelDetails, bookingNumber: next, bookingNumberConsent: !!next });
          }}
          unlocked={unlockedKeys.has("bookingNumber")}
          onUnlock={() => onUnlock("bookingNumber")}
        />
      );
    }
    // Flights are a repeatable array — kept read-only text here rather
    // than click-to-edit (would need add/remove-row controls to be a
    // real edit surface, out of proportion for what's otherwise a
    // review screen). Editing flight details goes back into the flow
    // via Back, same as before, for this one sub-case. Blank entries
    // (added via "+ Add flight" then left empty) are skipped, same
    // truthiness rule as every other row.
    travelDetails.flights.forEach((f, i) => {
      if (f.airline || f.flightNumber || f.dateTime) {
        const parts = [f.airline, f.flightNumber, f.dateTime].filter(Boolean).join(" · ");
        rows.push(
          <div className="review-row" key={`flight-${i}`}>
            <span className="review-label">{`Flight ${i + 1}`}</span>
            <span className="review-value" dir="auto">{parts}</span>
          </div>
        );
      }
    });
  } else if (selectedType === "PURCHASE") {
    rows = specRows(PURCHASE_SPECS, purchaseDetails, setPurchase, unlockedKeys, onUnlock);
  } else if (selectedType === "TECH_SUPPORT") {
    rows = specRows(TECH_SUPPORT_SPECS, techSupportDetails, setTechSupport, unlockedKeys, onUnlock);
  }

  return (
    <div className="review-summary">
      <LockedField
        label="Issue/Request"
        value={freeText}
        onChange={(e) => onFreeTextChange(e.target.value)}
        unlocked={unlockedKeys.has("freeText")}
        onUnlock={() => onUnlock("freeText")}
      />
      <LockedField
        label="Urgency"
        type="select"
        options={urgencyOptions}
        value={urgency}
        onChange={(e) => onUrgencyChange(e.target.value)}
        unlocked={unlockedKeys.has("urgency")}
        onUnlock={() => onUnlock("urgency")}
      />
      {(additionalInfo || selectedType === "RESEARCH" || selectedType === "INFO") && (
        <LockedField
          label="Anything else"
          value={additionalInfo}
          onChange={(e) => onAdditionalInfoChange(e.target.value)}
          unlocked={unlockedKeys.has("additionalInfo")}
          onUnlock={() => onUnlock("additionalInfo")}
        />
      )}
      {rows}
    </div>
  );
}

export default ReviewSummary;
