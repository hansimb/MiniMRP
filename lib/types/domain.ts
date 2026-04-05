export interface Product {
  id: string;
  name: string;
  image: string | null;
}

export interface ProductVersion {
  id: string;
  product_id: string;
  version_number: string;
}

export interface ComponentMaster {
  id: string;
  name: string;
  category: string;
  producer: string;
  value: string | null;
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

export interface Attachment {
  id: string;
  version_id: string;
  file_path: string;
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
  references: Array<{
    reference: string;
    component: ComponentMaster | null;
  }>;
}

export interface ComponentListItem extends ComponentMaster {
  quantity_available: number | null;
  purchase_price: number | null;
}

export interface ComponentDetail extends ComponentMaster {
  inventory: InventoryItem | null;
  sellers: Array<{
    seller: Seller;
    product_url: string | null;
  }>;
  references: Array<{
    reference: string;
    version: ProductVersion | null;
  }>;
}

