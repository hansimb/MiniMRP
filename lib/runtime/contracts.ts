import type {
  AppSettings,
  ComponentDetail,
  ComponentListItem,
  ComponentMaster,
  HistoryEvent,
  InventoryItem,
  ProductDetail,
  ProductListItem,
  ProductionListItem,
  PurchasingItem,
  VersionDetail
} from "@/lib/types/domain";

type RuntimeResult<T> = Promise<{ error: string | null } & T>;
type RuntimeAction = (formData: FormData) => Promise<void>;

export interface RuntimeQueries {
  getHistoryEntries: () => RuntimeResult<{ items: HistoryEvent[] }>;
  getInventoryOverview: (filters?: { category?: string; search?: string }) => RuntimeResult<{
    items: Array<InventoryItem & { component: ComponentMaster | null }>;
  }>;
  getPartCatalog: (filters?: { category?: string; search?: string }) => RuntimeResult<{ items: ComponentListItem[] }>;
  getPartDetail: (id: string) => RuntimeResult<{ item: ComponentDetail | null }>;
  getProductDetail: (id: string) => RuntimeResult<{ item: ProductDetail | null }>;
  getProductList: () => RuntimeResult<{ items: ProductListItem[] }>;
  getProductionOverview: () => RuntimeResult<{
    underProduction: ProductionListItem[];
    completed: ProductionListItem[];
  }>;
  getPurchasingOverview: () => RuntimeResult<{
    shortages: PurchasingItem[];
    nearSafety: PurchasingItem[];
  }>;
  getAppSettings: () => RuntimeResult<{ item: AppSettings | null }>;
  getVersionDetail: (id: string, options?: { productionEntryId?: string | null }) => RuntimeResult<{
    item: VersionDetail | null;
  }>;
}

export interface RuntimeActions {
  addInventoryAction: RuntimeAction;
  addProductionEntryAction: RuntimeAction;
  adjustInventoryDeltaAction: RuntimeAction;
  attachPartToVersionAction: RuntimeAction;
  cancelProductionEntryAction: RuntimeAction;
  completeProductionEntryAction: RuntimeAction;
  createPartAction: RuntimeAction;
  createProductAction: RuntimeAction;
  createSellerForPartAction: RuntimeAction;
  createVersionAction: RuntimeAction;
  deleteInventoryLotAction: RuntimeAction;
  deletePartAction: RuntimeAction;
  deleteVersionAction: RuntimeAction;
  deleteVersionAttachmentAction: RuntimeAction;
  importMasterDataAction: RuntimeAction;
  importVersionBomAction: RuntimeAction;
  removePartFromVersionAction: RuntimeAction;
  removeProductImageAction: RuntimeAction;
  updateDefaultSafetyStockAction: RuntimeAction;
  updateInventoryLotAction: RuntimeAction;
  updatePartAction: RuntimeAction;
  updatePartSafetyStockAction: RuntimeAction;
  updateProductAction: RuntimeAction;
  updateVersionAction: RuntimeAction;
  updateVersionComponentReferencesAction: RuntimeAction;
  uploadProductImageAction: RuntimeAction;
  uploadVersionAttachmentAction: RuntimeAction;
  upsertPartSellerLinkAction: RuntimeAction;
}
