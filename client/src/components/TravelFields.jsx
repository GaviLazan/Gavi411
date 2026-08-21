import Input from "./Input";
import Button from "./Button";
import "./TravelFields.css";

// TRAVEL-specific follow-up fields (G411-65). All optional — these are
// prompts to jog memory for info the friend might not think to give
// upfront, not a required intake gate. No group headers, just visual
// separators (Gavi's call) — grouped internally in this file for
// readability, not shown to the user as labeled sections.

// Starting shape for `value` below — exported so NewRequest.jsx can
// seed its useState without duplicating TRAVEL's field list itself.
export const EMPTY_TRAVEL_DETAILS = {
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
  rentalHotelDate: "",
  rentalHotelLocation: "",
  rentalHotelCompany: "",
  rentalHotelRef: "",
  whatHappened: "",
  whoContacted: "",
  connectionFlexibility: "",
};

function TravelFields({ value, onChange }) {
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

  return (
    <>
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
        + Add another flight
      </Button>

      <Input
        label="Booking number"
        placeholder="Optional"
        value={value.bookingNumber}
        onChange={(e) => set("bookingNumber", e.target.value)}
        disabled={!value.bookingNumberConsent}
      />
      <label className="consent-checkbox">
        <input
          type="checkbox"
          checked={value.bookingNumberConsent}
          onChange={(e) => set("bookingNumberConsent", e.target.checked)}
        />
        I understand sharing my booking number gives Gavi access to this booking
      </label>

      <hr />

      <Input
        label="Rental car / hotel: dates"
        value={value.rentalHotelDate}
        onChange={(e) => set("rentalHotelDate", e.target.value)}
      />
      <Input
        label="Location"
        value={value.rentalHotelLocation}
        onChange={(e) => set("rentalHotelLocation", e.target.value)}
      />
      <Input
        label="Company"
        value={value.rentalHotelCompany}
        onChange={(e) => set("rentalHotelCompany", e.target.value)}
      />
      <Input
        label="Reference number"
        value={value.rentalHotelRef}
        onChange={(e) => set("rentalHotelRef", e.target.value)}
      />

      <hr />

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
    </>
  );
}

export default TravelFields
