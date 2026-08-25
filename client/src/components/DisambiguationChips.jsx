import Chip from "./Chip";

// Chip list for the "chips" step (G411-21). Two modes: real matches +
// "None of these", or (when showFullTypeList is true) the full type
// list with no "None of these" chip, since that's already been picked.
function DisambiguationChips({
  matchedTypes,
  allTypes,
  typeLabels,
  showFullTypeList,
  pickedType,
  onSelect,
  onNoneOfThese,
}) {
  const types = showFullTypeList ? allTypes : matchedTypes;

  return (
    <div className="chip-row">
      {types.map((type) => (
        <Chip key={type} selected={type === pickedType} onClick={() => onSelect(type)}>
          {typeLabels[type]}
        </Chip>
      ))}
      {!showFullTypeList && <Chip onClick={onNoneOfThese}>None of these</Chip>}
    </div>
  );
}

export default DisambiguationChips;
