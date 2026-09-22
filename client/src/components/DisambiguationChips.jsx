import Chip from "./Chip";

// Chip list: either matched types + "None of these", or full type list without "None of these".
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
