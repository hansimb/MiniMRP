"use client";

import { useState } from "react";
import {
  buildPartPickerState,
  type PickerPart
} from "@/features/parts/components/part-picker-state";

export function PartPicker(props: {
  parts: PickerPart[];
  categoryFieldId?: string;
  componentNameFieldId?: string;
  producerFieldId?: string;
  componentFieldId?: string;
  componentFieldName?: string;
  componentLabel?: string;
  required?: boolean;
}) {
  const [category, setCategory] = useState("all");
  const [componentName, setComponentName] = useState("");
  const [producer, setProducer] = useState("");
  const [componentId, setComponentId] = useState("");
  const categoryFieldId = props.categoryFieldId ?? "part-category-filter";
  const componentNameFieldId = props.componentNameFieldId ?? "part-name-filter";
  const producerFieldId = props.producerFieldId ?? "part-producer-filter";
  const componentFieldId = props.componentFieldId ?? "part-id";
  const componentFieldName = props.componentFieldName ?? "component_id";
  const componentLabel = props.componentLabel ?? "Component";
  const isRequired = props.required ?? true;
  const state = buildPartPickerState(props.parts, {
    category,
    componentName,
    producer,
    componentId
  });

  return (
    <>
      <div className="field-group">
        <label htmlFor={categoryFieldId}>Category</label>
        <select
          id={categoryFieldId}
          className="select"
          value={category}
          onChange={(event) => {
            setCategory(event.target.value);
            setComponentName("");
            setProducer("");
            setComponentId("");
          }}
        >
          <option value="all">All categories</option>
          {state.categories.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>
      <div className="field-group">
        <label htmlFor={componentNameFieldId}>{componentLabel}</label>
        <select
          id={componentNameFieldId}
          className="select"
          value={state.selectedComponentName}
          required={isRequired}
          disabled={state.componentOptions.length <= 1}
          onChange={(event) => {
            setComponentName(event.target.value);
            setProducer("");
            setComponentId("");
          }}
        >
          <option value="">All components</option>
          {state.componentOptions.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>
      <div className="field-group">
        <label htmlFor={producerFieldId}>Producer</label>
        <select
          id={producerFieldId}
          className="select"
          value={state.selectedProducer}
          required={isRequired}
          disabled={state.producerOptions.length <= 1}
          onChange={(event) => {
            setProducer(event.target.value);
            setComponentId("");
          }}
        >
          <option value="">All producers</option>
          {state.producerOptions.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>
      <input
        id={componentFieldId}
        type="hidden"
        name={componentFieldName}
        value={state.selectedComponentId}
        onChange={(event) => setComponentId(event.target.value)}
      />
    </>
  );
}
