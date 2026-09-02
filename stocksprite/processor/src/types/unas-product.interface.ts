/** One row of the UNAS product-database CSV as parsed by the processor. */
export interface IUnasProductRow {
    sku: string;
    stocks: Map<number, number>;
}
