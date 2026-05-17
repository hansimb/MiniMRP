import { getDesktopDatabasePath } from "../lib/runtime/sqlite/files.ts";
import { resetAndSeedSqliteDatabase } from "../lib/runtime/sqlite/dev-seed.ts";

const databasePath = getDesktopDatabasePath();
const summary = resetAndSeedSqliteDatabase(databasePath);

console.log(`Reset desktop SQLite database (${summary.strategy}): ${databasePath}`);
console.log(
  `Seeded ${summary.products} products, ${summary.versions} versions, ${summary.components} components, ${summary.inventoryLots} lots, ${summary.productionEntries} production entries.`
);
