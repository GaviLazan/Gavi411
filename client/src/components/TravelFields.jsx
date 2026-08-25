import { useState } from "react";
import Input from "./Input";
import Select from "./Select";
import Button from "./Button";
import "./TravelFields.css";

// TRAVEL-specific follow-up fields (G411-65, regrouped G411-74). All
// optional — these are prompts to jog memory for info the friend might
// not think to give upfront, not a required intake gate. No group
// headers, just visual separators (Gavi's call) — grouped internally in
// this file for readability, not shown to the user as labeled sections.
//
// G411-74 regroup (Gavi's mockup, session 2026-08-25): urgency moves in
// front (bundled with the "what happened" group, first thing the friend
// sees after picking TRAVEL); dates/destination split from
// airline/layover preferences (a "decision" vs. a "preference", split
// regardless of screen fit — Gavi's explicit call); rental car and
// hotel split into two independent objects (used to be one merged
// group) and, along with flights, each now sits behind its own
// "+ Add [X] details" toggle instead of always being shown.

// Starting shape for `value` below — exported so NewRequest.jsx can
// seed its useState without duplicating TRAVEL's field list itself.
export const EMPTY_TRAVEL_DETAILS = {
  whatHappened: "",
  whoContacted: "",
  connectionFlexibility: "",
  departureDate: "",
  returnDate: "",
  origin: "",
  destination: "",
  preferredAirlines: "",
  layoverPreference: "",
  otherPreferences: "",
  flights: [],
  bookingNumber: "",
  bookingNumberConsent: false,
  hotel: null,
  car: null,
};

const EMPTY_HOTEL = { date: "", location: "", company: "", ref: "" };
const EMPTY_CAR = { date: "", location: "", company: "", ref: "" };

// Urgency is owned by NewRequest.jsx (shared across every type) — passed
// in as props here purely so it can render inside TRAVEL's first group
// rather than only at the very end.
function TravelFields({ value, onChange, urgency, onUrgencyChange, urgencyOptions }) {
  const [showHotel, setShowHotel] = useState(!!value.hotel);
  const [showCar, setShowCar] = useState(!!value.car);

  function set(field, fieldValue) {
    onChange({ ...value, [field]: fieldValue });
  }

  function addFlight() {
    set("flights", [...value.flights, { airline: "", flightNumber: "", dateTime: "" }]);
  }

  function updateFlight(index, field, fieldValue) {
    const flights = value.flights.map((f, i) =>
      i === index ? { ...f, [field]: fieldValue } : f
    );
    set("flights", flights);
  }

  function toggleHotel() {
    if (showHotel) {
      setShowHotel(false);
      set("hotel", null);
    } else {
      setShowHotel(true);
      set("hotel", EMPTY_HOTEL);
    }
  }

  function toggleCar() {
    if (showCar) {
      setShowCar(false);
      set("car", null);
    } else {
      setShowCar(true);
      set("car", EMPTY_CAR);
    }
  }

  function setHotel(field, fieldValue) {
    set("hotel", { ...value.hotel, [field]: fieldValue });
  }

  function setCar(field, fieldValue) {
    set("car", { ...value.car, [field]: fieldValue });
  }

  return (
    <>
      <Input
        label="What happened?"
        value={value.whatHappened}
        onChange={(e) => set("whatHappened", e.target.value)}
      />
      <Input
        label="Who have you already contacted about it, if anyone?"
        value={value.whoContacted}
        onChange={(e) => set("whoContacted", e.target.value)}
      />
      <Input
        label="Any connecting flights you need to make, and how flexible is your arrival time?"
        value={value.connectionFlexibility}
        onChange={(e) => set("connectionFlexibility", e.target.value)}
      />
      <Select
        label="Urgency"
        options={urgencyOptions}
        value={urgency}
        onChange={(e) => onUrgencyChange(e.target.value)}
      />

      <hr />

      <Input
        label="Departure date"
        type="date"
        value={value.departureDate}
        onChange={(e) => set("departureDate", e.target.value)}
      />
      <Input
        label="Return date"
        type="date"
        value={value.returnDate}
        onChange={(e) => set("returnDate", e.target.value)}
      />
      <Input
        label="Origin"
        value={value.origin}
        onChange={(e) => set("origin", e.target.value)}
      />
      <Input
        label="Destination"
        value={value.destination}
        onChange={(e) => set("destination", e.target.value)}
      />

      <hr />

      <Input
        label="Preferred airline(s)"
        value={value.preferredAirlines}
        onChange={(e) => set("preferredAirlines", e.target.value)}
      />
      <Input
        label="Layover preference"
        placeholder="e.g. nonstop only, one layover OK"
        value={value.layoverPreference}
        onChange={(e) => set("layoverPreference", e.target.value)}
      />
      <Input
        label="Any other constraints or preferences?"
        placeholder="e.g. aisle seat, budget cap, specific loyalty program"
        value={value.otherPreferences}
        onChange={(e) => set("otherPreferences", e.target.value)}
      />

      <hr />

      {value.flights.map((flight, i) => (
        <div key={i} className="flight-entry">
          <Input
            label={`Airline (flight ${i + 1})`}
            value={flight.airline}
            onChange={(e) => updateFlight(i, "airline", e.target.value)}
          />
          <Input
            label="Flight number"
            value={flight.flightNumber}
            onChange={(e) => updateFlight(i, "flightNumber", e.target.value)}
          />
          <Input
            label="Flight date & time"
            type="datetime-local"
            value={flight.dateTime}
            onChange={(e) => updateFlight(i, "dateTime", e.target.value)}
          />
        </div>
      ))}
      <Button variant="secondary" onClick={addFlight}>
        {value.flights.length === 0 ? "+ Add flight details" : "+ Add another flight"}
      </Button>

      <label className="consent-checkbox">
        <input
          type="checkbox"
          checked={value.bookingNumberConsent}
          onChange={(e) => {
            const checked = e.target.checked;
            // Unchecking means "don't share it" — clear any typed value so
            // nothing lingers in state to accidentally submit.
            onChange({ ...value, bookingNumberConsent: checked, bookingNumber: checked ? value.bookingNumber : "" });
          }}
        />
        Click here to share your booking number. You are aware that doing so may give Gavi access to this booking.
      </label>
      {value.bookingNumberConsent && (
        <Input
          label="Booking number"
          value={value.bookingNumber}
          onChange={(e) => set("bookingNumber", e.target.value)}
        />
      )}

      <hr />

      <Button variant="secondary" onClick={toggleHotel}>
        {showHotel ? "− Remove hotel details" : "+ Add hotel details"}
      </Button>
      {showHotel && (
        <div className="flight-entry">
          <Input
            label="Hotel dates"
            value={value.hotel.date}
            onChange={(e) => setHotel("date", e.target.value)}
          />
          <Input
            label="Location"
            value={value.hotel.location}
            onChange={(e) => setHotel("location", e.target.value)}
          />
          <Input
            label="Company"
            value={value.hotel.company}
            onChange={(e) => setHotel("company", e.target.value)}
          />
          <Input
            label="Reference number"
            value={value.hotel.ref}
            onChange={(e) => setHotel("ref", e.target.value)}
          />
        </div>
      )}

      <Button variant="secondary" onClick={toggleCar}>
        {showCar ? "− Remove rental car details" : "+ Add rental car details"}
      </Button>
      {showCar && (
        <div className="flight-entry">
          <Input
            label="Rental dates"
            value={value.car.date}
            onChange={(e) => setCar("date", e.target.value)}
          />
          <Input
            label="Location"
            value={value.car.location}
            onChange={(e) => setCar("location", e.target.value)}
          />
          <Input
            label="Company"
            value={value.car.company}
            onChange={(e) => setCar("company", e.target.value)}
          />
          <Input
            label="Reference number"
            value={value.car.ref}
            onChange={(e) => setCar("ref", e.target.value)}
          />
        </div>
      )}
    </>
  );
}

export default TravelFields;
