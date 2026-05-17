export interface PickerPart {
  id: string;
  name: string;
  category: string;
  producer: string;
  value: string | null;
}

interface PartPickerSelections {
  category: string;
  componentName: string;
  producer: string;
  componentId: string;
}

export function formatPartOptionLabel(part: PickerPart) {
  return part.name;
}

export function buildPartPickerState(parts: PickerPart[], selections: PartPickerSelections) {
  const categories = uniqueSorted(parts.map((part) => part.category));
  const categoryFiltered = parts.filter((part) =>
    selections.category === "all" ? true : part.category === selections.category
  );
  let selectedProducer = resolveSelection(
    selections.producer,
    uniqueSorted(categoryFiltered.map((part) => part.producer))
  );
  let componentOptions = getComponentOptions(categoryFiltered, selectedProducer);
  let selectedComponentName = resolveSelection(selections.componentName, componentOptions);
  let producerOptions = getProducerOptions(categoryFiltered, selectedComponentName);

  selectedProducer = resolveSelection(selectedProducer, producerOptions);
  componentOptions = getComponentOptions(categoryFiltered, selectedProducer);
  selectedComponentName = resolveSelection(selectedComponentName, componentOptions);
  producerOptions = getProducerOptions(categoryFiltered, selectedComponentName);

  const filteredParts = categoryFiltered.filter((part) =>
    (selectedComponentName ? part.name === selectedComponentName : true) &&
    (selectedProducer ? part.producer === selectedProducer : true)
  );
  const selectedComponentId =
    filteredParts.length === 1
      ? filteredParts[0]?.id ?? ""
      : filteredParts.some((part) => part.id === selections.componentId)
        ? selections.componentId
        : "";

  return {
    categories,
    componentOptions,
    producerOptions,
    selectedComponentName,
    selectedProducer,
    selectedComponentId,
    filteredParts,
    showComponentFilter: true,
    showProducerFilter: true,
  };
}

function resolveSelection(selectedValue: string, options: string[]) {
  if (options.length === 1) {
    return options[0] ?? "";
  }

  return options.includes(selectedValue) ? selectedValue : "";
}

function getComponentOptions(parts: PickerPart[], selectedProducer: string) {
  return uniqueSorted(
    parts
      .filter((part) => (selectedProducer ? part.producer === selectedProducer : true))
      .map((part) => part.name)
  );
}

function getProducerOptions(parts: PickerPart[], selectedComponentName: string) {
  return uniqueSorted(
    parts
      .filter((part) => (selectedComponentName ? part.name === selectedComponentName : true))
      .map((part) => part.producer)
  );
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}
