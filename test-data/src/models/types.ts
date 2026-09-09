import type { ISetProduct, IWarehouseResponse } from "@storesprite/unas-json-client";

export interface StockMapping {
  warehouse: string;
  stock: string;
}

export interface SupplierMappingConfig {
  sku: string;
  title?: string;
  description?: string;
  category?: number | string;
  stocks: StockMapping[];
}

export interface ProductStock {
  warehouseId: string;
  isActive: string;
  qty: string;
}

export interface MappedProduct {
  sku: string;
  title: string;
  description: string;
  category?: number | string;
  stocks: ProductStock[];
}

export interface SupplierFeedDef {
  name: string;
  csvFileName: string;
  mappingFileName: string;
}

export interface WarehouseSyncResult {
  nameToId: Map<string, string>; // warehouseName -> warehouseId (string)
  existingCount: number;
  createdCount: number;
}

export type { ISetProduct, IWarehouseResponse };
