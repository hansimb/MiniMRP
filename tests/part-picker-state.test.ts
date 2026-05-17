import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPartPickerState,
  formatPartOptionLabel,
  type PickerPart
} from "../features/parts/components/part-picker-state.ts";

const RESISTOR_PARTS: PickerPart[] = [
  {
    id: "res-yageo-10k",
    name: "Resistor 10k 0603",
    category: "Resistor",
    producer: "Yageo",
    value: "10k"
  },
  {
    id: "res-vishay-10k",
    name: "Resistor 10k 0603",
    category: "Resistor",
    producer: "Vishay",
    value: "10k"
  },
  {
    id: "res-yageo-1k",
    name: "Resistor 1k 0603",
    category: "Resistor",
    producer: "Yageo",
    value: "1k"
  }
];

test("formatPartOptionLabel shows the plain component name", () => {
  assert.equal(
    formatPartOptionLabel({
      id: "ic-ne5532",
      name: "NE5532 Op Amp",
      category: "IC",
      producer: "Texas Instruments",
      value: "NE5532"
    }),
    "NE5532 Op Amp"
  );
});

test("buildPartPickerState auto-selects component, producer, and component id when only one path exists", () => {
  const state = buildPartPickerState(
    [
      {
        id: "display-oled",
        name: "OLED Display 128x64",
        category: "Display",
        producer: "Raystar",
        value: "128x64"
      }
    ],
      {
        category: "Display",
        componentName: "",
        producer: "",
        componentId: ""
      }
    );

  assert.equal(state.selectedComponentName, "OLED Display 128x64");
  assert.equal(state.selectedProducer, "Raystar");
  assert.equal(state.selectedComponentId, "display-oled");
  assert.equal(state.showComponentFilter, true);
  assert.equal(state.showProducerFilter, true);
});

test("buildPartPickerState narrows options by category, component, and producer", () => {
  const state = buildPartPickerState(RESISTOR_PARTS, {
    category: "Resistor",
    componentName: "Resistor 10k 0603",
    producer: "Yageo",
    componentId: ""
  });

  assert.deepEqual(state.componentOptions, ["Resistor 10k 0603", "Resistor 1k 0603"]);
  assert.deepEqual(state.producerOptions, ["Vishay", "Yageo"]);
  assert.equal(state.selectedComponentName, "Resistor 10k 0603");
  assert.equal(state.selectedProducer, "Yageo");
  assert.equal(state.filteredParts.length, 1);
  assert.equal(state.selectedComponentId, "res-yageo-10k");
});

test("buildPartPickerState lets producer selection filter component options", () => {
  const state = buildPartPickerState(RESISTOR_PARTS, {
    category: "Resistor",
    componentName: "",
    producer: "Vishay",
    componentId: ""
  });

  assert.deepEqual(state.componentOptions, ["Resistor 10k 0603"]);
  assert.equal(state.selectedProducer, "Vishay");
  assert.equal(state.selectedComponentName, "Resistor 10k 0603");
  assert.equal(state.selectedComponentId, "res-vishay-10k");
});

test("buildPartPickerState resets invalid component and producer selections after category change", () => {
  const state = buildPartPickerState(RESISTOR_PARTS, {
    category: "Resistor",
    componentName: "Unknown component",
    producer: "Texas Instruments",
    componentId: "non-existent"
  });

  assert.equal(state.selectedComponentName, "");
  assert.equal(state.selectedProducer, "");
  assert.equal(state.selectedComponentId, "");
  assert.equal(state.filteredParts.length, 3);
});
