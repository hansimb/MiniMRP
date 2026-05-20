import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("supabase production schema adds near_safety_threshold_percent to app_settings", () => {
  const privateTablesSql = readFileSync(
    new URL("../supabase/production/11_private_tables.sql", import.meta.url),
    "utf8"
  );
  const migrationSql = readFileSync(
    new URL("../supabase/production/12_app_settings_near_safety_threshold.sql", import.meta.url),
    "utf8"
  );

  assert.equal(privateTablesSql.includes("near_safety_threshold_percent integer not null default 10"), true);
  assert.equal(
    migrationSql.includes("add column if not exists near_safety_threshold_percent integer not null default 10"),
    true
  );
});

test("supabase live demo schema and seed include the near-safety threshold default", () => {
  const schemaSql = readFileSync(
    new URL("../supabase/live-demo/schema.sql", import.meta.url),
    "utf8"
  );
  const seedSql = readFileSync(
    new URL("../supabase/live-demo/seed.sql", import.meta.url),
    "utf8"
  );

  assert.equal(schemaSql.includes("near_safety_threshold_percent integer not null default 10"), true);
  assert.equal(schemaSql.includes("insert into app_settings (id, default_safety_stock, near_safety_threshold_percent)"), true);
  assert.equal(seedSql.includes("insert into app_settings (id, default_safety_stock, near_safety_threshold_percent)"), true);
});

test("supabase settings queries fall back cleanly when the new threshold column is missing", () => {
  const settingsQuerySource = readFileSync(
    new URL("../lib/supabase/queries/settings.ts", import.meta.url),
    "utf8"
  );
  const purchasingQuerySource = readFileSync(
    new URL("../lib/supabase/queries/purchasing.ts", import.meta.url),
    "utf8"
  );

  assert.equal(settingsQuerySource.includes('select("id,default_safety_stock")'), true);
  assert.equal(settingsQuerySource.includes("near_safety_threshold_percent: 10"), true);
  assert.equal(purchasingQuerySource.includes("settingsMissingThresholdColumn"), true);
});
