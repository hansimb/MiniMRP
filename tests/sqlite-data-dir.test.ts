import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { getDefaultDesktopDataDirectory, getDesktopDataDirectory } from "../lib/runtime/sqlite/files.ts";
import { resetDesktopDatabaseForTests } from "../lib/runtime/sqlite/db.ts";
import { getProductDetail, getProductList } from "../lib/runtime/sqlite/queries.ts";
import { run } from "../lib/runtime/sqlite/shared.ts";

const originalDesktopDataDir = process.env.MINIMRP_DESKTOP_DATA_DIR;
const originalAppData = process.env.APPDATA;
const originalXdgDataHome = process.env.XDG_DATA_HOME;

test.afterEach(() => {
  resetDesktopDatabaseForTests();

  if (originalDesktopDataDir === undefined) {
    delete process.env.MINIMRP_DESKTOP_DATA_DIR;
  } else {
    process.env.MINIMRP_DESKTOP_DATA_DIR = originalDesktopDataDir;
  }

  if (originalAppData === undefined) {
    delete process.env.APPDATA;
  } else {
    process.env.APPDATA = originalAppData;
  }

  if (originalXdgDataHome === undefined) {
    delete process.env.XDG_DATA_HOME;
  } else {
    process.env.XDG_DATA_HOME = originalXdgDataHome;
  }
});

test("desktop data directory honors explicit override", () => {
  process.env.MINIMRP_DESKTOP_DATA_DIR = path.join("C:", "tmp", "minimrp-test");

  assert.equal(getDesktopDataDirectory(), process.env.MINIMRP_DESKTOP_DATA_DIR);
});

test("desktop data directory defaults to a stable user-scoped location", () => {
  delete process.env.MINIMRP_DESKTOP_DATA_DIR;

  if (process.platform === "win32") {
    process.env.APPDATA = path.join("C:", "Users", "tester", "AppData", "Roaming");
    assert.equal(getDefaultDesktopDataDirectory(), path.join(process.env.APPDATA, "MiniMRP"));
    return;
  }

  if (process.platform === "darwin") {
    assert.equal(getDefaultDesktopDataDirectory(), path.join(os.homedir(), "Library", "Application Support", "MiniMRP"));
    return;
  }

  process.env.XDG_DATA_HOME = path.join("/tmp", "tester-share");
  assert.equal(getDefaultDesktopDataDirectory(), path.join(process.env.XDG_DATA_HOME, "MiniMRP"));
});

test("desktop sqlite data survives a database reopen from the same user data directory", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "minimrp-desktop-persist-"));
  process.env.MINIMRP_DESKTOP_DATA_DIR = tempDir;

  try {
    run("insert into products (id, name, image) values (:id, :name, null)", {
      id: "product-1",
      name: "Restart-safe product"
    });
    run(
      "insert into product_versions (id, product_id, version_number) values (:id, :product_id, :version_number)",
      {
        id: "version-1",
        product_id: "product-1",
        version_number: "A"
      }
    );
    run("update products set name = :name where id = :id", {
      id: "product-1",
      name: "Restart-safe product updated"
    });

    resetDesktopDatabaseForTests();

    const productList = await getProductList();
    const productDetail = await getProductDetail("product-1");

    assert.equal(productList.error, null);
    assert.equal(productList.items.length, 1);
    assert.equal(productList.items[0]?.name, "Restart-safe product updated");
    assert.equal(productList.items[0]?.versionCount, 1);

    assert.equal(productDetail.error, null);
    assert.equal(productDetail.item?.name, "Restart-safe product updated");
    assert.equal(productDetail.item?.versions.length, 1);
    assert.equal(productDetail.item?.versions[0]?.version_number, "A");
  } finally {
    resetDesktopDatabaseForTests();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
