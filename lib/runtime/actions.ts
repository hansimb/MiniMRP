"use server";

import { getRuntimeMode } from "./env.ts";
import type { RuntimeActions } from "./contracts.ts";

async function getRuntimeActionsModule(): Promise<RuntimeActions> {
  const runtimeMode = getRuntimeMode();

  if (runtimeMode === "sqlite") {
    return (await import(`./${runtimeMode}/actions.ts`)) as RuntimeActions;
  }

  return (await import("./supabase/actions.ts")) as RuntimeActions;
}

export async function addInventoryAction(formData: FormData) {
  return (await getRuntimeActionsModule()).addInventoryAction(formData);
}

export async function addProductionEntryAction(formData: FormData) {
  return (await getRuntimeActionsModule()).addProductionEntryAction(formData);
}

export async function adjustInventoryDeltaAction(formData: FormData) {
  return (await getRuntimeActionsModule()).adjustInventoryDeltaAction(formData);
}

export async function attachPartToVersionAction(formData: FormData) {
  return (await getRuntimeActionsModule()).attachPartToVersionAction(formData);
}

export async function cancelProductionEntryAction(formData: FormData) {
  return (await getRuntimeActionsModule()).cancelProductionEntryAction(formData);
}

export async function completeProductionEntryAction(formData: FormData) {
  return (await getRuntimeActionsModule()).completeProductionEntryAction(formData);
}

export async function createPartAction(formData: FormData) {
  return (await getRuntimeActionsModule()).createPartAction(formData);
}

export async function createProductAction(formData: FormData) {
  return (await getRuntimeActionsModule()).createProductAction(formData);
}

export async function createSellerForPartAction(formData: FormData) {
  return (await getRuntimeActionsModule()).createSellerForPartAction(formData);
}

export async function createVersionAction(formData: FormData) {
  return (await getRuntimeActionsModule()).createVersionAction(formData);
}

export async function deleteInventoryLotAction(formData: FormData) {
  return (await getRuntimeActionsModule()).deleteInventoryLotAction(formData);
}

export async function deletePartAction(formData: FormData) {
  return (await getRuntimeActionsModule()).deletePartAction(formData);
}

export async function deleteVersionAction(formData: FormData) {
  return (await getRuntimeActionsModule()).deleteVersionAction(formData);
}

export async function deleteVersionAttachmentAction(formData: FormData) {
  return (await getRuntimeActionsModule()).deleteVersionAttachmentAction(formData);
}

export async function importMasterDataAction(formData: FormData) {
  return (await getRuntimeActionsModule()).importMasterDataAction(formData);
}

export async function importVersionBomAction(formData: FormData) {
  return (await getRuntimeActionsModule()).importVersionBomAction(formData);
}

export async function removePartFromVersionAction(formData: FormData) {
  return (await getRuntimeActionsModule()).removePartFromVersionAction(formData);
}

export async function removeProductImageAction(formData: FormData) {
  return (await getRuntimeActionsModule()).removeProductImageAction(formData);
}

export async function updateDefaultSafetyStockAction(formData: FormData) {
  return (await getRuntimeActionsModule()).updateDefaultSafetyStockAction(formData);
}

export async function updateInventoryLotAction(formData: FormData) {
  return (await getRuntimeActionsModule()).updateInventoryLotAction(formData);
}

export async function updatePartAction(formData: FormData) {
  return (await getRuntimeActionsModule()).updatePartAction(formData);
}

export async function updatePartSafetyStockAction(formData: FormData) {
  return (await getRuntimeActionsModule()).updatePartSafetyStockAction(formData);
}

export async function updateProductAction(formData: FormData) {
  return (await getRuntimeActionsModule()).updateProductAction(formData);
}

export async function updateVersionAction(formData: FormData) {
  return (await getRuntimeActionsModule()).updateVersionAction(formData);
}

export async function updateVersionComponentReferencesAction(formData: FormData) {
  return (await getRuntimeActionsModule()).updateVersionComponentReferencesAction(formData);
}

export async function uploadProductImageAction(formData: FormData) {
  return (await getRuntimeActionsModule()).uploadProductImageAction(formData);
}

export async function uploadVersionAttachmentAction(formData: FormData) {
  return (await getRuntimeActionsModule()).uploadVersionAttachmentAction(formData);
}

export async function upsertPartSellerLinkAction(formData: FormData) {
  return (await getRuntimeActionsModule()).upsertPartSellerLinkAction(formData);
}
