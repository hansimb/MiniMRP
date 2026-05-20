export interface Product {
  id: string;
  name: string;
  image: string | null;
  image_path: string | null;
}

export interface ProductVersion {
  id: string;
  product_id: string;
  version_number: string;
}

export interface ComponentMaster {
  id: string;
  sku: string;
  name: string;
  category: string;
  producer: string;
  value: string | null;
  safety_stock: number;
}

export interface Seller {
  id: string;
  name: string;
  base_url: string | null;
  lead_time: number | null;
}

export interface ComponentSeller {
  component_id: string;
  seller_id: string;
  product_url: string | null;
}

export interface ComponentReference {
  version_id: string;
  component_master_id: string;
  reference: string;
}

export interface InventoryItem {
  id: string;
  component_id: string;
  quantity_available: number;
  purchase_price: number | null;
}

export interface InventoryLot {
  id: string;
  component_id: string;
  quantity_received: number;
  quantity_remaining: number;
  unit_cost: number;
  received_at: string;
  source: string | null;
  notes: string | null;
  created_at: string;
}

export interface HistoryEvent {
  id: string;
  entity_type: string;
  entity_id: string | null;
  action_type: string;
  summary: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

export interface AppSettings {
  id: boolean;
  default_safety_stock: number;
  near_safety_threshold_percent: number;
}

export interface Attachment {
  id: string;
  version_id: string;
  file_path: string;
  file_url: string | null;
  file_name: string | null;
  is_image: boolean;
}

export interface ProductListItem extends Product {
  versionCount: number;
}

export interface ProductDetail extends Product {
  versions: ProductVersion[];
}

export interface VersionDetail extends ProductVersion {
  product: Product | null;
  attachments: Attachment[];
  active_production_quantity: number;
  active_production_count: number;
  references: Array<{
    reference: string;
    component: ComponentMaster | null;
  }>;
  components: Array<{
    component: ComponentMaster;
    references: string[]; 
    quantity: number;
    lead_time: number | null;
    inventory: InventoryItem | null;
    reserved?: {
      gross_requirement: number;
      inventory_consumed: number;
      inventory_consumed_cost?: number;
      net_requirement: number;
      entry_gross_requirement?: number | null;
      entry_inventory_consumed: number | null;
      entry_inventory_consumed_cost?: number | null;
      entry_net_requirement?: number | null;
      active_production_quantity: number;
      active_entry_count: number;
    };
  }>;
}

export interface ComponentListItem extends ComponentMaster {
  used_in_versions: Array<{
    product_name: string;
    version_number: string;
    references: string[];
    quantity: number;
  }>;
}

export interface ComponentDetail extends ComponentMaster {
  inventory: InventoryItem | null;
  inventory_lots: InventoryLot[];
  sellers: Array<{
    seller: Seller;
    product_url: string | null;
  }>;
  references: Array<{
    reference: string;
    version: ProductVersion | null;
    product: Product | null;
  }>;
}

export interface PurchasingItem extends ComponentMaster {
  gross_requirement: number;
  reserved_inventory: number;
  quantity_available: number;
  purchase_price: number | null;
  lead_time: number | null;
  net_need: number;
  seller_id?: string | null;
  seller_name?: string | null;
  seller_base_url?: string | null;
  seller_product_url?: string | null;
  recommended_order_quantity: number;
}

export interface ProductionShortageItem extends PurchasingItem {
  production_entry_id: string;
  product_name: string;
  version_number: string;
  build_quantity: number;
}

export interface ProductionShortageGroup {
  production_entry_id: string;
  product_name: string;
  version_number: string;
  build_quantity: number;
  label: string;
  items: ProductionShortageItem[];
}

export interface ProductionEntry {
  id: string;
  version_id: string;
  quantity: number;
  status: "under_production" | "completed";
  completed_at: string | null;
  created_at: string;
}

export interface ProductionRequirement {
  id: string;
  production_entry_id: string;
  component_id: string;
  gross_requirement: number;
  inventory_consumed: number;
  inventory_consumed_cost?: number;
  net_requirement: number;
  created_at: string;
}

export interface ProductionListItem extends ProductionEntry {
  product: Product | null;
  version: ProductVersion | null;
  longest_lead_time: number | null;
}
