"use client";

import { useMemo, useState } from "react";
import { importMasterDataAction } from "@/lib/supabase/actions/index";
import { MASTER_DATA_REQUIRED_COLUMNS, parseSpreadsheetFile } from "@/lib/import/master-data";
import { Notice, Panel } from "@/shared/ui";

export function MasterDataImportPanel() {
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const columns = useMemo(() => Object.keys(rows[0] ?? {}), [rows]);

  async function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      setRows([]);
      setFileName(null);
      setError(null);
      return;
    }

    setError(null);
    setFileName(file.name);

    try {
      const parsed = await parseSpreadsheetFile(file);
      setRows(parsed.slice(0, 8).map((row) => Object.fromEntries(
        Object.entries(row).map(([key, value]) => [key, String(value ?? "")])
      )));
    } catch {
      setRows([]);
      setError("Could not read the selected file.");
    }
  }

  return (
    <Panel
      title="Master data import"
      description="Import component master data, inventory balances, and seller links from one file."
    >
      <form action={importMasterDataAction} className="stack">
        <div className="field-group">
          <label htmlFor="master-data-file">Spreadsheet file</label>
          <input
            id="master-data-file"
            className="input"
            type="file"
            name="file"
            accept=".csv,.xlsx,.xls,.ods"
            required
            onChange={onFileChange}
          />
        </div>

        <div className="small muted">
          Supported formats: CSV, Excel, and ODS. First sheet only.
        </div>

        <div className="small muted">
          Required columns: {MASTER_DATA_REQUIRED_COLUMNS.join(", ")}
        </div>

        <div className="action-row">
          <button className="button primary" type="submit">
            Import master data
          </button>
          <a className="button-link subtle" href="/master-data-sample-a.csv">
            Download sample A
          </a>
          <a className="button-link subtle" href="/master-data-sample-b.csv">
            Download sample B
          </a>
          {fileName ? <span className="small muted">Loaded file: {fileName}</span> : null}
        </div>

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
      </form>
    </Panel>
  );
}
