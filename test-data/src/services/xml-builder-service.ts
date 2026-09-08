import type { MappedProduct, ProductStock } from '../models/types.js';

export class XmlBuilderService {
  public buildPayloadXml(products: MappedProduct[]): string {
    const productXmlChunks = products.map((product) => this.renderProduct(product));

    return `<?xml version="1.0" encoding="UTF-8" ?>\n<Products>\n${productXmlChunks.join('\n')}\n</Products>\n`;
  }

  public renderProduct(product: MappedProduct): string {
    const sku = this.escapeXml(product.sku);
    const safeTitle = this.escapeCdata(product.title);
    const safeDescription = this.escapeCdata(product.description);
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
        <Stocks>
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
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  public escapeCdata(text: string): string {
    // If text contains ']]>', split it so the CDATA section is safely terminated and reopened
    return text.replace(/\]\]>/g, ']]]]><![CDATA[>');
  }
}
