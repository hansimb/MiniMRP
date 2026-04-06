"use client";

import { useState } from "react";

interface PickerPart {
  id: string;
  name: string;
  category: string;
  value: string | null;
}

export function PartPicker(props: {
  parts: PickerPart[];
  categoryFieldId?: string;
  componentFieldId?: string;
  componentFieldName?: string;
  componentLabel?: string;
}) {
  const [category, setCategory] = useState("all");
  const categoryFieldId = props.categoryFieldId ?? "part-category-filter";
  const componentFieldId = props.componentFieldId ?? "part-id";
  const componentFieldName = props.componentFieldName ?? "component_id";
  const componentLabel = props.componentLabel ?? "Component";

  const categories = Array.from(new Set(props.parts.map((part) => part.category))).sort();
  const filteredParts = props.parts.filter((part) =>
    category === "all" ? true : part.category === category
  );

  return (
    <>
      <div className="field-group">
        <label htmlFor={categoryFieldId}>Category</label>
        <select
          id={categoryFieldId}
          className="select"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          <option value="all">All categories</option>
          {categories.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>
      <div className="field-group">
        <label htmlFor={componentFieldId}>{componentLabel}</label>
        <select
          id={componentFieldId}
          className="select"
          name={componentFieldName}
          defaultValue=""
        >
          <option value="" disabled>
            Select component
          </option>
          {filteredParts.map((part) => (
            <option key={part.id} value={part.id}>
              {part.name} - {part.category} - {part.value ?? "-"}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}
