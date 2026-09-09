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

export interface UnasTokenData {
  token: string;
  createdAt: string;
}
