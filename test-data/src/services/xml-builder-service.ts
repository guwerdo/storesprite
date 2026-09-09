import type { MappedProduct, ProductStock } from '../models/types.js';
import { escapeCdata as escapeCdataText, escapeXml as escapeXmlText } from '../utils/xml.js';

export class XmlBuilderService {
  public buildPayloadXml(products: MappedProduct[]): string {
    const productXmlChunks = products.map((product) => this.renderProduct(product));

    return `<?xml version="1.0" encoding="UTF-8" ?>\n<Products>\n${productXmlChunks.join('\n')}\n</Products>\n`;
  }

  public renderProduct(product: MappedProduct): string {
    const sku = this.escapeXml(product.sku);
    const safeTitle = this.escapeCdata(product.title);
    const safeDescription = this.escapeCdata(product.description);
    const categoriesXml = this.renderCategories(product.category);
    const stocksXml = this.renderStocks(product.stocks);

    return `    <Product>
        <Sku>${sku}</Sku>
        <Action>add</Action>
        <Name> <![CDATA[${safeTitle}]]> </Name>
        <Description>
            <Long>
                <![CDATA[ ${safeDescription} ]]>
            </Long>
        </Description>
${categoriesXml}        <Stocks>
            <Status>
                <Active>1</Active>
            </Status>
${stocksXml}
        </Stocks>\t\t
        <Prices>
            <Vat>27%</Vat>
            <Price>
                <Type>normal</Type>
                <Net>100</Net>
                <Gross>200</Gross>
                <Actual>1</Actual>
            </Price>
        </Prices>
    </Product>`;
  }

  public renderCategories(category?: number | string): string {
    if (category === undefined || category === null || String(category).trim() === '') {
      return '';
    }

    const safeCategory = this.escapeXml(String(category).trim());
    return `        <Categories>
            <Category>
                <Type>base</Type>
                <Id>${safeCategory}</Id>
            </Category>
        </Categories>\n`;
  }

  public renderStocks(stocks: ProductStock[]): string {
    return stocks
      .map(
        (s) => `            <Stock>
                <WarehouseId>${this.escapeXml(s.warehouseId)}</WarehouseId>
                <IsActive>${this.escapeXml(s.isActive)}</IsActive>
                <Qty>${this.escapeXml(s.qty)}</Qty>
            </Stock>`
      )
      .join('\n');
  }

  public escapeXml(text: string): string {
    return escapeXmlText(text);
  }

  public escapeCdata(text: string): string {
    return escapeCdataText(text);
  }
}
