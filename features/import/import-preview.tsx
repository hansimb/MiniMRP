"use client";

import { useState } from "react";
import Papa from "papaparse";
import readXlsxFile from "read-excel-file";
import { Notice, Panel } from "@/components/ui";

type ImportRow = Record<string, string>;

async function parseFile(file: File): Promise<ImportRow[]> {
  const lowerName = file.name.toLowerCase();

  if (lowerName.endsWith(".csv")) {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => resolve(results.data as ImportRow[]),
        error: reject
      });
    });
  }

  const rows = await readXlsxFile(file);
  if (rows.length === 0) {
    return [];
  }

  const headers = rows[0].map((cell) => String(cell ?? "").trim());
  return rows.slice(1).map((row) =>
    headers.reduce<ImportRow>((accumulator, header, index) => {
      accumulator[header] = String(row[index] ?? "");
      return accumulator;
    }, {})
  );
}

export function ImportPreview(props: {
  title: string;
  description: string;
  mappingHint: string;
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

  return (
    <Panel title={props.title} description={props.description}>
      <div className="file-drop">
        <input
          className="input"
          type="file"
          accept=".csv,.xlsx,.xls"
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
    </Panel>
  );
}
