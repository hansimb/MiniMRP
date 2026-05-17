import fs from "fs";
import path from "path";
import type { DatabaseSync as DatabaseSyncType } from "node:sqlite";
import { calculateInventorySummaryFromLots } from "../../mappers/inventory-lots.ts";
import type { InventoryLot } from "../../types/domain.ts";
import { createDesktopDatabase, ensureSqliteSchema } from "./db.ts";

type SeedProduct = {
  id: string;
  name: string;
};

type SeedVersion = {
  id: string;
  product_id: string;
  version_number: string;
};

type SeedComponent = {
  id: string;
  sku: string;
  name: string;
  category: string;
  producer: string;
  value: string | null;
  safety_stock: number;
};

type SeedSeller = {
  id: string;
  name: string;
  base_url: string;
  lead_time: number;
};

type SeedSellerLink = {
  component_id: string;
  seller_id: string;
  product_url: string;
};

type SeedReference = {
  version_id: string;
  component_master_id: string;
  reference: string;
};

type SeedProductionEntry = {
  id: string;
  version_id: string;
  quantity: number;
  status: "under_production" | "completed";
  completed_at: string | null;
  created_at: string;
};

type SeedProductionRequirement = {
  id: string;
  production_entry_id: string;
  component_id: string;
  gross_requirement: number;
  inventory_consumed: number;
  net_requirement: number;
  created_at: string;
};

type SeedHistoryEvent = {
  id: string;
  entity_type: string;
  entity_id: string | null;
  action_type: string;
  summary: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
};

type SeedLot = Omit<InventoryLot, "component_id"> & { component_id: string };

export type SqliteDevSeedSummary = {
  strategy: "recreated" | "reused";
  products: number;
  versions: number;
  components: number;
  sellers: number;
  sellerLinks: number;
  references: number;
  inventoryLots: number;
  productionEntries: number;
  productionRequirements: number;
  historyEvents: number;
};

function run(db: DatabaseSyncType, sql: string, params: Record<string, string | number | null>) {
  db.prepare(sql).run(params);
}

function clearSqliteData(db: DatabaseSyncType) {
  db.exec(`
    delete from history_events;
    delete from production_requirements;
    delete from production_entries;
    delete from attachments;
    delete from inventory_lots;
    delete from inventory;
    delete from component_references;
    delete from component_sellers;
    delete from sellers;
    delete from product_versions;
    delete from components;
    delete from products;
    delete from app_settings;
  `);
}

function insertInventoryLotsForComponent(db: DatabaseSyncType, componentId: string, lots: SeedLot[]) {
  for (const lot of lots) {
    run(
      db,
      `
        insert into inventory_lots (
          id,
          component_id,
          quantity_received,
          quantity_remaining,
          unit_cost,
          received_at,
          source,
          notes,
          created_at
        ) values (
          :id,
          :component_id,
          :quantity_received,
          :quantity_remaining,
          :unit_cost,
          :received_at,
          :source,
          :notes,
          :created_at
        )
      `,
      {
        id: lot.id,
        component_id: componentId,
        quantity_received: lot.quantity_received,
        quantity_remaining: lot.quantity_remaining,
        unit_cost: lot.unit_cost,
        received_at: lot.received_at,
        source: lot.source,
        notes: lot.notes,
        created_at: lot.created_at
      }
    );
  }

  const summary = calculateInventorySummaryFromLots(lots);
  run(
    db,
    `
      insert into inventory (id, component_id, quantity_available, purchase_price)
      values (:id, :component_id, :quantity_available, :purchase_price)
    `,
    {
      id: `inv-${componentId}`,
      component_id: componentId,
      quantity_available: summary.quantity_available,
      purchase_price: summary.purchase_price
    }
  );
}

export function resetSqliteDatabaseFile(databasePath: string) {
  const directory = path.dirname(databasePath);
  fs.mkdirSync(directory, { recursive: true });

  for (const filePath of [databasePath, `${databasePath}-shm`, `${databasePath}-wal`]) {
    if (fs.existsSync(filePath)) {
      fs.rmSync(filePath, { force: true });
    }
  }
}

export function seedSqliteDevDatabase(db: DatabaseSyncType): SqliteDevSeedSummary {
  ensureSqliteSchema(db);
  clearSqliteData(db);

  const products: SeedProduct[] = [
    { id: "product-analyzer", name: "SAI Spectrum Analyzer" },
    { id: "product-interface", name: "SAI Audio Interface" },
    { id: "product-controller", name: "SAI Monitor Controller" },
    { id: "product-generator", name: "SAI Signal Generator" },
    { id: "product-preamp", name: "SAI Rack Preamp" }
  ];

  const versions: SeedVersion[] = [
    { id: "version-analyzer-a", product_id: "product-analyzer", version_number: "A" },
    { id: "version-analyzer-b", product_id: "product-analyzer", version_number: "B" },
    { id: "version-interface-a", product_id: "product-interface", version_number: "A" },
    { id: "version-controller-a", product_id: "product-controller", version_number: "A" },
    { id: "version-controller-b", product_id: "product-controller", version_number: "B" },
    { id: "version-generator-a", product_id: "product-generator", version_number: "A" },
    { id: "version-preamp-a", product_id: "product-preamp", version_number: "A" }
  ];

  const components: SeedComponent[] = [
    { id: "component-r10k", sku: "RES-10K-0603", name: "Resistor 10k 0603", category: "Resistor", producer: "Yageo", value: "10k", safety_stock: 2500 },
    { id: "component-r1k", sku: "RES-1K-0603", name: "Resistor 1k 0603", category: "Resistor", producer: "Yageo", value: "1k", safety_stock: 1800 },
    { id: "component-r100", sku: "RES-100R-0603", name: "Resistor 100R 0603", category: "Resistor", producer: "Yageo", value: "100R", safety_stock: 1200 },
    { id: "component-c100n", sku: "CAP-100NF-0603", name: "Capacitor 100nF 0603", category: "Capacitor", producer: "Murata", value: "100nF", safety_stock: 2200 },
    { id: "component-c10u", sku: "CAP-10UF-0805", name: "Capacitor 10uF 0805", category: "Capacitor", producer: "Murata", value: "10uF", safety_stock: 900 },
    { id: "component-c47u", sku: "CAP-47UF-1206", name: "Capacitor 47uF 1206", category: "Capacitor", producer: "Nichicon", value: "47uF", safety_stock: 300 },
    { id: "component-ne5532", sku: "IC-NE5532", name: "NE5532 Op Amp", category: "IC", producer: "Texas Instruments", value: "NE5532", safety_stock: 120 },
    { id: "component-opa2134", sku: "IC-OPA2134", name: "OPA2134 Op Amp", category: "IC", producer: "Texas Instruments", value: "OPA2134", safety_stock: 80 },
    { id: "component-tl072", sku: "IC-TL072", name: "TL072 Op Amp", category: "IC", producer: "Texas Instruments", value: "TL072", safety_stock: 120 },
    { id: "component-stm32", sku: "IC-STM32F405", name: "STM32F405 MCU", category: "IC", producer: "STMicroelectronics", value: "STM32F405", safety_stock: 40 },
    { id: "component-dac", sku: "IC-AK4452", name: "AK4452 DAC", category: "IC", producer: "Asahi Kasei", value: "AK4452", safety_stock: 25 },
    { id: "component-adc", sku: "IC-PCM1808", name: "PCM1808 ADC", category: "IC", producer: "Texas Instruments", value: "PCM1808", safety_stock: 25 },
    { id: "component-oled", sku: "DSP-OLED-128X64", name: "OLED Display 128x64", category: "Display", producer: "Raystar", value: "128x64", safety_stock: 12 },
    { id: "component-encoder", sku: "MEC-ENC-EC11", name: "Rotary Encoder EC11", category: "Mechanical", producer: "Bourns", value: "EC11", safety_stock: 30 },
    { id: "component-xlrf", sku: "CON-XLR-F", name: "XLR Female Connector", category: "Connector", producer: "Neutrik", value: "NC3FAH", safety_stock: 40 },
    { id: "component-xlrm", sku: "CON-XLR-M", name: "XLR Male Connector", category: "Connector", producer: "Neutrik", value: "NC3MAH", safety_stock: 40 },
    { id: "component-usbc", sku: "CON-USB-C", name: "USB-C Connector", category: "Connector", producer: "Amphenol", value: "USB-C", safety_stock: 150 },
    { id: "component-ledg", sku: "LED-GRN-0603", name: "LED Green 0603", category: "LED", producer: "Kingbright", value: "Green", safety_stock: 600 },
    { id: "component-ledr", sku: "LED-RED-0603", name: "LED Red 0603", category: "LED", producer: "Kingbright", value: "Red", safety_stock: 600 },
    { id: "component-relay", sku: "RLY-5V-G6K", name: "Relay 5V G6K", category: "Relay", producer: "Omron", value: "G6K", safety_stock: 20 },
    { id: "component-reg5", sku: "PWR-7805", name: "Linear Regulator 5V", category: "Power", producer: "Texas Instruments", value: "7805", safety_stock: 50 },
    { id: "component-crystal", sku: "XTAL-24MHZ", name: "Crystal 24MHz", category: "Timing", producer: "Abracon", value: "24MHz", safety_stock: 50 }
  ];

  const sellers: SeedSeller[] = [
    { id: "seller-mouser", name: "Mouser", base_url: "https://www.mouser.com", lead_time: 7 },
    { id: "seller-farnell", name: "Farnell", base_url: "https://fi.farnell.com", lead_time: 5 },
    { id: "seller-tme", name: "TME", base_url: "https://www.tme.eu", lead_time: 6 },
    { id: "seller-rs", name: "RS", base_url: "https://fi.rs-online.com", lead_time: 4 },
    { id: "seller-local", name: "Local Supplier", base_url: "https://supplier.example.com", lead_time: 2 }
  ];

  const sellerLinks: SeedSellerLink[] = [
    { component_id: "component-r10k", seller_id: "seller-mouser", product_url: "https://www.mouser.com/res-10k-0603" },
    { component_id: "component-r1k", seller_id: "seller-mouser", product_url: "https://www.mouser.com/res-1k-0603" },
    { component_id: "component-r100", seller_id: "seller-farnell", product_url: "https://fi.farnell.com/res-100r-0603" },
    { component_id: "component-c100n", seller_id: "seller-mouser", product_url: "https://www.mouser.com/cap-100nf-0603" },
    { component_id: "component-c10u", seller_id: "seller-tme", product_url: "https://www.tme.eu/cap-10uf-0805" },
    { component_id: "component-c47u", seller_id: "seller-rs", product_url: "https://fi.rs-online.com/cap-47uf-1206" },
    { component_id: "component-ne5532", seller_id: "seller-mouser", product_url: "https://www.mouser.com/ne5532" },
    { component_id: "component-opa2134", seller_id: "seller-farnell", product_url: "https://fi.farnell.com/opa2134" },
    { component_id: "component-tl072", seller_id: "seller-farnell", product_url: "https://fi.farnell.com/tl072" },
    { component_id: "component-stm32", seller_id: "seller-rs", product_url: "https://fi.rs-online.com/stm32f405" },
    { component_id: "component-dac", seller_id: "seller-mouser", product_url: "https://www.mouser.com/ak4452" },
    { component_id: "component-adc", seller_id: "seller-mouser", product_url: "https://www.mouser.com/pcm1808" },
    { component_id: "component-oled", seller_id: "seller-local", product_url: "https://supplier.example.com/oled-128x64" },
    { component_id: "component-encoder", seller_id: "seller-farnell", product_url: "https://fi.farnell.com/ec11" },
    { component_id: "component-xlrf", seller_id: "seller-tme", product_url: "https://www.tme.eu/xlr-female" },
    { component_id: "component-xlrm", seller_id: "seller-tme", product_url: "https://www.tme.eu/xlr-male" },
    { component_id: "component-usbc", seller_id: "seller-mouser", product_url: "https://www.mouser.com/usb-c-connector" },
    { component_id: "component-ledg", seller_id: "seller-rs", product_url: "https://fi.rs-online.com/led-green-0603" },
    { component_id: "component-ledr", seller_id: "seller-rs", product_url: "https://fi.rs-online.com/led-red-0603" },
    { component_id: "component-relay", seller_id: "seller-local", product_url: "https://supplier.example.com/relay-5v" },
    { component_id: "component-reg5", seller_id: "seller-mouser", product_url: "https://www.mouser.com/7805" },
    { component_id: "component-crystal", seller_id: "seller-rs", product_url: "https://fi.rs-online.com/24mhz-crystal" }
  ];

  const references: SeedReference[] = [
    { version_id: "version-analyzer-a", component_master_id: "component-r10k", reference: "R1" },
    { version_id: "version-analyzer-a", component_master_id: "component-r10k", reference: "R2" },
    { version_id: "version-analyzer-a", component_master_id: "component-c100n", reference: "C1" },
    { version_id: "version-analyzer-a", component_master_id: "component-ne5532", reference: "U1" },
    { version_id: "version-analyzer-a", component_master_id: "component-oled", reference: "DISP1" },
    { version_id: "version-analyzer-a", component_master_id: "component-encoder", reference: "ENC1" },

    { version_id: "version-analyzer-b", component_master_id: "component-r10k", reference: "R1" },
    { version_id: "version-analyzer-b", component_master_id: "component-r10k", reference: "R2" },
    { version_id: "version-analyzer-b", component_master_id: "component-r10k", reference: "R3" },
    { version_id: "version-analyzer-b", component_master_id: "component-r10k", reference: "R4" },
    { version_id: "version-analyzer-b", component_master_id: "component-c100n", reference: "C1" },
    { version_id: "version-analyzer-b", component_master_id: "component-c100n", reference: "C2" },
    { version_id: "version-analyzer-b", component_master_id: "component-c100n", reference: "C3" },
    { version_id: "version-analyzer-b", component_master_id: "component-opa2134", reference: "U1A" },
    { version_id: "version-analyzer-b", component_master_id: "component-opa2134", reference: "U1B" },
    { version_id: "version-analyzer-b", component_master_id: "component-stm32", reference: "U2" },
    { version_id: "version-analyzer-b", component_master_id: "component-oled", reference: "DISP1" },
    { version_id: "version-analyzer-b", component_master_id: "component-encoder", reference: "ENC1" },
    { version_id: "version-analyzer-b", component_master_id: "component-usbc", reference: "J1" },
    { version_id: "version-analyzer-b", component_master_id: "component-crystal", reference: "Y1" },

    { version_id: "version-interface-a", component_master_id: "component-c100n", reference: "C1" },
    { version_id: "version-interface-a", component_master_id: "component-c100n", reference: "C2" },
    { version_id: "version-interface-a", component_master_id: "component-ne5532", reference: "U1" },
    { version_id: "version-interface-a", component_master_id: "component-dac", reference: "U2" },
    { version_id: "version-interface-a", component_master_id: "component-adc", reference: "U3" },
    { version_id: "version-interface-a", component_master_id: "component-xlrf", reference: "XLR1" },
    { version_id: "version-interface-a", component_master_id: "component-xlrm", reference: "XLR2" },
    { version_id: "version-interface-a", component_master_id: "component-usbc", reference: "J1" },

    { version_id: "version-controller-a", component_master_id: "component-r1k", reference: "R1" },
    { version_id: "version-controller-a", component_master_id: "component-c10u", reference: "C1" },
    { version_id: "version-controller-a", component_master_id: "component-relay", reference: "K1" },
    { version_id: "version-controller-a", component_master_id: "component-ledg", reference: "LED1" },
    { version_id: "version-controller-a", component_master_id: "component-reg5", reference: "REG1" },

    { version_id: "version-controller-b", component_master_id: "component-r1k", reference: "R1" },
    { version_id: "version-controller-b", component_master_id: "component-r1k", reference: "R2" },
    { version_id: "version-controller-b", component_master_id: "component-c10u", reference: "C1" },
    { version_id: "version-controller-b", component_master_id: "component-c47u", reference: "C2" },
    { version_id: "version-controller-b", component_master_id: "component-relay", reference: "K1" },
    { version_id: "version-controller-b", component_master_id: "component-relay", reference: "K2" },
    { version_id: "version-controller-b", component_master_id: "component-ledg", reference: "LED1" },
    { version_id: "version-controller-b", component_master_id: "component-ledr", reference: "LED2" },
    { version_id: "version-controller-b", component_master_id: "component-reg5", reference: "REG1" },

    { version_id: "version-generator-a", component_master_id: "component-r100", reference: "R1" },
    { version_id: "version-generator-a", component_master_id: "component-c100n", reference: "C1" },
    { version_id: "version-generator-a", component_master_id: "component-tl072", reference: "U1" },
    { version_id: "version-generator-a", component_master_id: "component-ledr", reference: "LED1" },

    { version_id: "version-preamp-a", component_master_id: "component-r10k", reference: "R1" },
    { version_id: "version-preamp-a", component_master_id: "component-r10k", reference: "R2" },
    { version_id: "version-preamp-a", component_master_id: "component-c100n", reference: "C1" },
    { version_id: "version-preamp-a", component_master_id: "component-ne5532", reference: "U1" },
    { version_id: "version-preamp-a", component_master_id: "component-xlrf", reference: "XLR1" }
  ];

  const inventoryLots: Array<{ componentId: string; lots: SeedLot[] }> = [
    {
      componentId: "component-r10k",
      lots: [
        { id: "lot-r10k-1", component_id: "component-r10k", quantity_received: 5000, quantity_remaining: 2200, unit_cost: 0.0039, received_at: "2026-03-11T08:00:00.000Z", source: "Mouser", notes: "Main passive refill", created_at: "2026-03-11T08:00:00.000Z" },
        { id: "lot-r10k-2", component_id: "component-r10k", quantity_received: 4000, quantity_remaining: 4000, unit_cost: 0.0042, received_at: "2026-05-03T08:00:00.000Z", source: "Mouser", notes: null, created_at: "2026-05-03T08:00:00.000Z" }
      ]
    },
    {
      componentId: "component-r1k",
      lots: [
        { id: "lot-r1k-1", component_id: "component-r1k", quantity_received: 3000, quantity_remaining: 1400, unit_cost: 0.0041, received_at: "2026-03-14T08:00:00.000Z", source: "Mouser", notes: null, created_at: "2026-03-14T08:00:00.000Z" },
        { id: "lot-r1k-2", component_id: "component-r1k", quantity_received: 2500, quantity_remaining: 2500, unit_cost: 0.0043, received_at: "2026-04-22T08:00:00.000Z", source: "Mouser", notes: null, created_at: "2026-04-22T08:00:00.000Z" }
      ]
    },
    {
      componentId: "component-r100",
      lots: [
        { id: "lot-r100-1", component_id: "component-r100", quantity_received: 2000, quantity_remaining: 900, unit_cost: 0.0045, received_at: "2026-04-12T08:00:00.000Z", source: "Farnell", notes: null, created_at: "2026-04-12T08:00:00.000Z" }
      ]
    },
    {
      componentId: "component-c100n",
      lots: [
        { id: "lot-c100n-1", component_id: "component-c100n", quantity_received: 5000, quantity_remaining: 2600, unit_cost: 0.0082, received_at: "2026-02-18T08:00:00.000Z", source: "Mouser", notes: null, created_at: "2026-02-18T08:00:00.000Z" },
        { id: "lot-c100n-2", component_id: "component-c100n", quantity_received: 4000, quantity_remaining: 4000, unit_cost: 0.0088, received_at: "2026-05-08T08:00:00.000Z", source: "Mouser", notes: null, created_at: "2026-05-08T08:00:00.000Z" }
      ]
    },
    {
      componentId: "component-c10u",
      lots: [
        { id: "lot-c10u-1", component_id: "component-c10u", quantity_received: 1200, quantity_remaining: 480, unit_cost: 0.042, received_at: "2026-03-07T08:00:00.000Z", source: "TME", notes: null, created_at: "2026-03-07T08:00:00.000Z" }
      ]
    },
    {
      componentId: "component-c47u",
      lots: [
        { id: "lot-c47u-1", component_id: "component-c47u", quantity_received: 300, quantity_remaining: 140, unit_cost: 0.11, received_at: "2026-03-29T08:00:00.000Z", source: "RS", notes: null, created_at: "2026-03-29T08:00:00.000Z" }
      ]
    },
    {
      componentId: "component-ne5532",
      lots: [
        { id: "lot-ne5532-1", component_id: "component-ne5532", quantity_received: 180, quantity_remaining: 75, unit_cost: 1.18, received_at: "2026-03-19T08:00:00.000Z", source: "Mouser", notes: null, created_at: "2026-03-19T08:00:00.000Z" }
      ]
    },
    {
      componentId: "component-opa2134",
      lots: [
        { id: "lot-opa2134-1", component_id: "component-opa2134", quantity_received: 40, quantity_remaining: 3, unit_cost: 2.78, received_at: "2026-02-28T08:00:00.000Z", source: "Farnell", notes: "Low on premium op amp", created_at: "2026-02-28T08:00:00.000Z" }
      ]
    },
    {
      componentId: "component-tl072",
      lots: [
        { id: "lot-tl072-1", component_id: "component-tl072", quantity_received: 120, quantity_remaining: 62, unit_cost: 0.69, received_at: "2026-03-23T08:00:00.000Z", source: "Farnell", notes: null, created_at: "2026-03-23T08:00:00.000Z" }
      ]
    },
    {
      componentId: "component-stm32",
      lots: [
        { id: "lot-stm32-1", component_id: "component-stm32", quantity_received: 24, quantity_remaining: 0, unit_cost: 8.15, received_at: "2026-02-12T08:00:00.000Z", source: "RS", notes: "Consumed by prototype builds", created_at: "2026-02-12T08:00:00.000Z" }
      ]
    },
    {
      componentId: "component-dac",
      lots: [
        { id: "lot-dac-1", component_id: "component-dac", quantity_received: 35, quantity_remaining: 18, unit_cost: 4.6, received_at: "2026-03-30T08:00:00.000Z", source: "Mouser", notes: null, created_at: "2026-03-30T08:00:00.000Z" }
      ]
    },
    {
      componentId: "component-adc",
      lots: [
        { id: "lot-adc-1", component_id: "component-adc", quantity_received: 40, quantity_remaining: 22, unit_cost: 3.4, received_at: "2026-03-30T08:00:00.000Z", source: "Mouser", notes: null, created_at: "2026-03-30T08:00:00.000Z" }
      ]
    },
    {
      componentId: "component-oled",
      lots: [
        { id: "lot-oled-1", component_id: "component-oled", quantity_received: 10, quantity_remaining: 6, unit_cost: 10.8, received_at: "2026-04-04T08:00:00.000Z", source: "Local Supplier", notes: "Local emergency buy", created_at: "2026-04-04T08:00:00.000Z" }
      ]
    },
    {
      componentId: "component-encoder",
      lots: [
        { id: "lot-encoder-1", component_id: "component-encoder", quantity_received: 45, quantity_remaining: 18, unit_cost: 1.95, received_at: "2026-04-17T08:00:00.000Z", source: "Farnell", notes: null, created_at: "2026-04-17T08:00:00.000Z" }
      ]
    },
    {
      componentId: "component-xlrf",
      lots: [
        { id: "lot-xlrf-1", component_id: "component-xlrf", quantity_received: 60, quantity_remaining: 28, unit_cost: 2.55, received_at: "2026-03-26T08:00:00.000Z", source: "TME", notes: null, created_at: "2026-03-26T08:00:00.000Z" }
      ]
    },
    {
      componentId: "component-xlrm",
      lots: [
        { id: "lot-xlrm-1", component_id: "component-xlrm", quantity_received: 60, quantity_remaining: 31, unit_cost: 2.49, received_at: "2026-03-26T08:00:00.000Z", source: "TME", notes: null, created_at: "2026-03-26T08:00:00.000Z" }
      ]
    },
    {
      componentId: "component-usbc",
      lots: [
        { id: "lot-usbc-1", component_id: "component-usbc", quantity_received: 250, quantity_remaining: 90, unit_cost: 0.66, received_at: "2026-04-01T08:00:00.000Z", source: "Mouser", notes: null, created_at: "2026-04-01T08:00:00.000Z" }
      ]
    },
    {
      componentId: "component-ledg",
      lots: [
        { id: "lot-ledg-1", component_id: "component-ledg", quantity_received: 1200, quantity_remaining: 410, unit_cost: 0.021, received_at: "2026-04-15T08:00:00.000Z", source: "RS", notes: null, created_at: "2026-04-15T08:00:00.000Z" }
      ]
    },
    {
      componentId: "component-ledr",
      lots: [
        { id: "lot-ledr-1", component_id: "component-ledr", quantity_received: 1200, quantity_remaining: 220, unit_cost: 0.021, received_at: "2026-04-15T08:00:00.000Z", source: "RS", notes: null, created_at: "2026-04-15T08:00:00.000Z" }
      ]
    },
    {
      componentId: "component-relay",
      lots: [
        { id: "lot-relay-1", component_id: "component-relay", quantity_received: 24, quantity_remaining: 4, unit_cost: 1.76, received_at: "2026-04-09T08:00:00.000Z", source: "Local Supplier", notes: "Critical spare batch", created_at: "2026-04-09T08:00:00.000Z" }
      ]
    },
    {
      componentId: "component-reg5",
      lots: [
        { id: "lot-reg5-1", component_id: "component-reg5", quantity_received: 80, quantity_remaining: 52, unit_cost: 0.31, received_at: "2026-03-16T08:00:00.000Z", source: "Mouser", notes: null, created_at: "2026-03-16T08:00:00.000Z" }
      ]
    },
    {
      componentId: "component-crystal",
      lots: [
        { id: "lot-crystal-1", component_id: "component-crystal", quantity_received: 60, quantity_remaining: 5, unit_cost: 0.19, received_at: "2026-03-18T08:00:00.000Z", source: "RS", notes: "Running low", created_at: "2026-03-18T08:00:00.000Z" }
      ]
    }
  ];

  const productionEntries: SeedProductionEntry[] = [
    {
      id: "prod-entry-analyzer-b",
      version_id: "version-analyzer-b",
      quantity: 10,
      status: "under_production",
      completed_at: null,
      created_at: "2026-05-15T09:00:00.000Z"
    },
    {
      id: "prod-entry-controller-b",
      version_id: "version-controller-b",
      quantity: 6,
      status: "under_production",
      completed_at: null,
      created_at: "2026-05-16T09:30:00.000Z"
    },
    {
      id: "prod-entry-preamp-a",
      version_id: "version-preamp-a",
      quantity: 4,
      status: "completed",
      completed_at: "2026-05-10T14:00:00.000Z",
      created_at: "2026-05-07T08:00:00.000Z"
    }
  ];

  const productionRequirements: SeedProductionRequirement[] = [
    { id: "req-analyzer-r10k", production_entry_id: "prod-entry-analyzer-b", component_id: "component-r10k", gross_requirement: 40, inventory_consumed: 40, net_requirement: 0, created_at: "2026-05-15T09:01:00.000Z" },
    { id: "req-analyzer-c100n", production_entry_id: "prod-entry-analyzer-b", component_id: "component-c100n", gross_requirement: 30, inventory_consumed: 30, net_requirement: 0, created_at: "2026-05-15T09:01:00.000Z" },
    { id: "req-analyzer-opa2134", production_entry_id: "prod-entry-analyzer-b", component_id: "component-opa2134", gross_requirement: 20, inventory_consumed: 3, net_requirement: 17, created_at: "2026-05-15T09:01:00.000Z" },
    { id: "req-analyzer-stm32", production_entry_id: "prod-entry-analyzer-b", component_id: "component-stm32", gross_requirement: 10, inventory_consumed: 0, net_requirement: 10, created_at: "2026-05-15T09:01:00.000Z" },
    { id: "req-analyzer-oled", production_entry_id: "prod-entry-analyzer-b", component_id: "component-oled", gross_requirement: 10, inventory_consumed: 6, net_requirement: 4, created_at: "2026-05-15T09:01:00.000Z" },
    { id: "req-analyzer-encoder", production_entry_id: "prod-entry-analyzer-b", component_id: "component-encoder", gross_requirement: 10, inventory_consumed: 10, net_requirement: 0, created_at: "2026-05-15T09:01:00.000Z" },
    { id: "req-analyzer-usbc", production_entry_id: "prod-entry-analyzer-b", component_id: "component-usbc", gross_requirement: 10, inventory_consumed: 10, net_requirement: 0, created_at: "2026-05-15T09:01:00.000Z" },
    { id: "req-analyzer-crystal", production_entry_id: "prod-entry-analyzer-b", component_id: "component-crystal", gross_requirement: 10, inventory_consumed: 5, net_requirement: 5, created_at: "2026-05-15T09:01:00.000Z" },

    { id: "req-controller-r1k", production_entry_id: "prod-entry-controller-b", component_id: "component-r1k", gross_requirement: 12, inventory_consumed: 12, net_requirement: 0, created_at: "2026-05-16T09:31:00.000Z" },
    { id: "req-controller-c10u", production_entry_id: "prod-entry-controller-b", component_id: "component-c10u", gross_requirement: 6, inventory_consumed: 6, net_requirement: 0, created_at: "2026-05-16T09:31:00.000Z" },
    { id: "req-controller-c47u", production_entry_id: "prod-entry-controller-b", component_id: "component-c47u", gross_requirement: 6, inventory_consumed: 6, net_requirement: 0, created_at: "2026-05-16T09:31:00.000Z" },
    { id: "req-controller-relay", production_entry_id: "prod-entry-controller-b", component_id: "component-relay", gross_requirement: 12, inventory_consumed: 4, net_requirement: 8, created_at: "2026-05-16T09:31:00.000Z" },
    { id: "req-controller-ledg", production_entry_id: "prod-entry-controller-b", component_id: "component-ledg", gross_requirement: 6, inventory_consumed: 6, net_requirement: 0, created_at: "2026-05-16T09:31:00.000Z" },
    { id: "req-controller-ledr", production_entry_id: "prod-entry-controller-b", component_id: "component-ledr", gross_requirement: 6, inventory_consumed: 6, net_requirement: 0, created_at: "2026-05-16T09:31:00.000Z" },
    { id: "req-controller-reg5", production_entry_id: "prod-entry-controller-b", component_id: "component-reg5", gross_requirement: 6, inventory_consumed: 6, net_requirement: 0, created_at: "2026-05-16T09:31:00.000Z" }
  ];

  const historyEvents: SeedHistoryEvent[] = [
    {
      id: "history-seed",
      entity_type: "system",
      entity_id: null,
      action_type: "seed",
      summary: "Desktop SQLite database reset and seeded with realistic test data",
      old_value: null,
      new_value: JSON.stringify({ dataset: "dev", products: products.length, components: components.length }),
      created_at: "2026-05-17T07:30:00.000Z"
    },
    {
      id: "history-production",
      entity_type: "production",
      entity_id: "prod-entry-analyzer-b",
      action_type: "create",
      summary: "Queued Spectrum Analyzer version B for production",
      old_value: null,
      new_value: JSON.stringify({ quantity: 10 }),
      created_at: "2026-05-15T09:00:00.000Z"
    },
    {
      id: "history-stock",
      entity_type: "inventory",
      entity_id: "component-stm32",
      action_type: "update",
      summary: "STM32 stock reached zero after prototype batch",
      old_value: JSON.stringify({ quantity_available: 6 }),
      new_value: JSON.stringify({ quantity_available: 0 }),
      created_at: "2026-05-14T16:20:00.000Z"
    }
  ];

  db.exec("begin transaction;");

  try {
    run(db, "insert into app_settings (id, default_safety_stock) values (:id, :default_safety_stock)", {
      id: 1,
      default_safety_stock: 25
    });

    for (const product of products) {
      run(db, "insert into products (id, name, image) values (:id, :name, null)", product);
    }

    for (const version of versions) {
      run(
        db,
        "insert into product_versions (id, product_id, version_number) values (:id, :product_id, :version_number)",
        version
      );
    }

    for (const component of components) {
      run(
        db,
        `
          insert into components (id, sku, name, category, producer, value, safety_stock)
          values (:id, :sku, :name, :category, :producer, :value, :safety_stock)
        `,
        component
      );
    }

    for (const seller of sellers) {
      run(
        db,
        "insert into sellers (id, name, base_url, lead_time) values (:id, :name, :base_url, :lead_time)",
        seller
      );
    }

    for (const link of sellerLinks) {
      run(
        db,
        `
          insert into component_sellers (component_id, seller_id, product_url)
          values (:component_id, :seller_id, :product_url)
        `,
        link
      );
    }

    for (const reference of references) {
      run(
        db,
        `
          insert into component_references (version_id, component_master_id, reference)
          values (:version_id, :component_master_id, :reference)
        `,
        reference
      );
    }

    for (const row of inventoryLots) {
      insertInventoryLotsForComponent(db, row.componentId, row.lots);
    }

    for (const entry of productionEntries) {
      run(
        db,
        `
          insert into production_entries (id, version_id, quantity, status, completed_at, created_at)
          values (:id, :version_id, :quantity, :status, :completed_at, :created_at)
        `,
        entry
      );
    }

    for (const requirement of productionRequirements) {
      run(
        db,
        `
          insert into production_requirements (
            id,
            production_entry_id,
            component_id,
            gross_requirement,
            inventory_consumed,
            net_requirement,
            created_at
          ) values (
            :id,
            :production_entry_id,
            :component_id,
            :gross_requirement,
            :inventory_consumed,
            :net_requirement,
            :created_at
          )
        `,
        requirement
      );
    }

    for (const event of historyEvents) {
      run(
        db,
        `
          insert into history_events (
            id,
            entity_type,
            entity_id,
            action_type,
            summary,
            old_value,
            new_value,
            created_at
          ) values (
            :id,
            :entity_type,
            :entity_id,
            :action_type,
            :summary,
            :old_value,
            :new_value,
            :created_at
          )
        `,
        event
      );
    }

    db.exec("commit;");
  } catch (error) {
    db.exec("rollback;");
    throw error;
  }

  return {
    strategy: "reused",
    products: products.length,
    versions: versions.length,
    components: components.length,
    sellers: sellers.length,
    sellerLinks: sellerLinks.length,
    references: references.length,
    inventoryLots: inventoryLots.reduce((total, item) => total + item.lots.length, 0),
    productionEntries: productionEntries.length,
    productionRequirements: productionRequirements.length,
    historyEvents: historyEvents.length
  };
}

export function resetAndSeedSqliteDatabase(databasePath: string) {
  let strategy: "recreated" | "reused" = "recreated";

  try {
    resetSqliteDatabaseFile(databasePath);
  } catch (error) {
    const errorCode = error instanceof Error && "code" in error ? String(error.code) : "";
    if (errorCode !== "EPERM" && errorCode !== "EBUSY") {
      throw error;
    }

    strategy = "reused";
  }

  const db = createDesktopDatabase(databasePath);

  try {
    const summary = seedSqliteDevDatabase(db);
    return { ...summary, strategy };
  } finally {
    db.close();
  }
}
