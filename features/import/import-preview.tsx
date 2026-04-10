"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { parseSpreadsheetFile } from "@/lib/import/master-data";
import { Notice, Panel } from "@/shared/ui";

type ImportRow = Record<string, string>;

async function parseFile(file: File): Promise<ImportRow[]> {
  return (await parseSpreadsheetFile(file)).map((row) =>
    Object.fromEntries(Object.entries(row).map(([key, value]) => [key, String(value ?? "")]))
  );
}

export function ImportPreview(props: {
  title: string;
  description: string;
  mappingHint: string;
  actions?: ReactNode;
  plain?: boolean;
}) {
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  async function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setError(null);
    setFileName(file.name);

    try {
      const parsed = await parseFile(file);
      setRows(parsed.slice(0, 8));
    } catch {
      setRows([]);
      setError("Could not read the selected file.");
    }
  }

  const columns = Object.keys(rows[0] ?? {});

  const content = (
    <>
      <div className="file-drop">
        <input
          className="input"
          type="file"
          accept=".csv,.xlsx,.xls,.ods"
          onChange={onFileChange}
        />
        <div className="small muted">{props.mappingHint}</div>
        {fileName ? <div className="small">Loaded file: {fileName}</div> : null}
        {error ? <Notice error>{error}</Notice> : null}
        {rows.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {columns.map((column) => (
                    <th key={column}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={index}>
                    {columns.map((column) => (
                      <td key={column}>{row[column]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </>
  );

  if (props.plain) {
    return content;
  }

  return (
    <Panel title={props.title} description={props.description} actions={props.actions}>
      {content}
    </Panel>
  );
}
