import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("version reference update actions validate reference conflicts before deleting existing rows", () => {
  const sqliteSource = fs.readFileSync("lib/runtime/sqlite/actions.ts", "utf8");
  const supabaseSource = fs.readFileSync("lib/supabase/actions/versions.ts", "utf8");
  const sqliteUpdateBlock = sqliteSource.slice(
    sqliteSource.indexOf("export async function updateVersionComponentReferencesAction"),
    sqliteSource.indexOf("export async function importVersionBomAction")
  );
  const supabaseUpdateBlock = supabaseSource.slice(
    supabaseSource.indexOf("export async function updateVersionComponentReferencesAction"),
    supabaseSource.indexOf("export async function updateVersionAction")
  );

  const sqliteValidateIndex = sqliteUpdateBlock.indexOf("validateVersionComponentReferences(");
  const sqliteDeleteIndex = sqliteUpdateBlock.indexOf("delete from component_references");
  assert.equal(sqliteValidateIndex >= 0, true);
  assert.equal(sqliteDeleteIndex >= 0, true);
  assert.equal(sqliteValidateIndex < sqliteDeleteIndex, true);
  assert.equal(sqliteUpdateBlock.includes("bomImportError"), true);

  const supabaseValidateIndex = supabaseUpdateBlock.indexOf("validateVersionComponentReferences(");
  const supabaseDeleteIndex = supabaseUpdateBlock.indexOf(".delete()");
  assert.equal(supabaseValidateIndex >= 0, true);
  assert.equal(supabaseDeleteIndex >= 0, true);
  assert.equal(supabaseValidateIndex < supabaseDeleteIndex, true);
  assert.equal(supabaseUpdateBlock.includes("bomImportError"), true);
});
