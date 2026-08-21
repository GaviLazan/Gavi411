import Input from "./Input";
import Select from "./Select";

// TECH_SUPPORT-specific follow-up fields (G411-65). All optional —
// prompts to jog memory, not a required intake gate (same rule as
// every other type's follow-up fields). No group headers, just <hr>
// separators.

const HELP_STYLE_OPTIONS = [
  { value: "", label: "Not sure yet" },
  { value: "CALL", label: "Hop on a call" },
  { value: "WRITTEN", label: "Send me written steps" },
];

// Starting shape for `value` below — exported so NewRequest.jsx can
// seed its useState without duplicating TECH_SUPPORT's field list itself.
export const EMPTY_TECH_SUPPORT_DETAILS = {
  device: "",
  issue: "",
  triedAlready: "",
  startedWhen: "",
  trigger: "",
  helpStyle: "",
};

function TechSupportFields({ value, onChange }) {
  function set(field, fieldValue) {
    onChange({ ...value, [field]: fieldValue });
  }

  return (
    <>
      <Input
        label="Device / platform"
        placeholder="e.g. iPhone, Windows laptop, Android tablet"
        value={value.device}
        onChange={(e) => set("device", e.target.value)}
      />
      <Input
        label="What's the issue?"
        value={value.issue}
        onChange={(e) => set("issue", e.target.value)}
      />

      <hr />

      <Input
        label="What have you already tried, if anything?"
        value={value.triedAlready}
        onChange={(e) => set("triedAlready", e.target.value)}
      />
      <Input
        label="When did this start?"
        value={value.startedWhen}
        onChange={(e) => set("startedWhen", e.target.value)}
      />
      <Input
        label="Does it happen after something specific?"
        placeholder="e.g. after an update, only when opening a certain app"
        value={value.trigger}
        onChange={(e) => set("trigger", e.target.value)}
      />

      <hr />

      <Select
        label="Would you rather hop on a call, or get written steps?"
        options={HELP_STYLE_OPTIONS}
        value={value.helpStyle}
        onChange={(e) => set("helpStyle", e.target.value)}
      />
    </>
  );
}

export default TechSupportFields;
