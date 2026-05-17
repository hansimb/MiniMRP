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

test("desktop product list reports correct version counts with more than five products", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "minimrp-desktop-version-counts-"));
  process.env.MINIMRP_DESKTOP_DATA_DIR = tempDir;

  try {
    const products = [
      { id: "product-1", name: "Alpha", versions: ["A"] },
      { id: "product-2", name: "Beta", versions: ["A", "B"] },
      { id: "product-3", name: "Gamma", versions: [] },
      { id: "product-4", name: "Delta", versions: ["A", "B", "C"] },
      { id: "product-5", name: "Epsilon", versions: ["A"] },
      { id: "product-6", name: "Zeta", versions: ["A", "B"] },
      { id: "product-7", name: "Eta", versions: ["A", "B", "C", "D"] },
      { id: "product-8", name: "Theta", versions: [] }
    ];

    for (const product of products) {
      run("insert into products (id, name, image) values (:id, :name, null)", {
        id: product.id,
        name: product.name
      });

      for (const versionNumber of product.versions) {
        run(
          "insert into product_versions (id, product_id, version_number) values (:id, :product_id, :version_number)",
          {
            id: `${product.id}-${versionNumber}`,
            product_id: product.id,
            version_number: versionNumber
          }
        );
      }
    }

    resetDesktopDatabaseForTests();

    const productList = await getProductList();

    assert.equal(productList.error, null);
    assert.equal(productList.items.length, products.length);

    const versionCountByName = new Map(productList.items.map((item) => [item.name, item.versionCount]));
    assert.equal(versionCountByName.get("Alpha"), 1);
    assert.equal(versionCountByName.get("Beta"), 2);
    assert.equal(versionCountByName.get("Gamma"), 0);
    assert.equal(versionCountByName.get("Delta"), 3);
    assert.equal(versionCountByName.get("Epsilon"), 1);
    assert.equal(versionCountByName.get("Zeta"), 2);
    assert.equal(versionCountByName.get("Eta"), 4);
    assert.equal(versionCountByName.get("Theta"), 0);
  } finally {
    resetDesktopDatabaseForTests();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
