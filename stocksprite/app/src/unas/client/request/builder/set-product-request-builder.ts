import { XMLBuilder } from "fast-xml-parser";

import { UnasParamType } from "../../../../types/unas-param.type.js";
import { STOCKSPRITE_UNAS_PARAM_DESCRIPTION, STOCKSPRITE_UNAS_PARAM_IMAGES, STOCKSPRITE_UNAS_PARAM_NAME } from "../../../constants.js";
import { DataDto } from "../../../dto/data-dto.interface.js";
import { StockDto } from "../../../dto/index.js";
import { IDataElement } from "./interfaces/data-element.interface.js";
import { IDescriptionElement } from "./interfaces/description-element.interface.js";
import { IImageElement } from "./interfaces/image-element.interface.js";
import { IImagesElement } from "./interfaces/images-element.interface.js";
import { IParamElement } from "./interfaces/param-element.interface.js";
import { IProductElement } from "./interfaces/product-element.interface.js";
import { ISetProductRequest } from "./interfaces/set-product-request.interface.js";
import { IStockElement } from "./interfaces/stock-element.interface.js";

export class SetProductRequestBuilder {
    build(productElements: IProductElement[]): string {
        // `format: false` and `indentBy` is important it removes xml formatting.
        // Unas won't accept file names like this in the xml.
        // It will cause an: "Invalid character in file name error" from Unas:
        // <Filename>
        //      <![CDATA[elsokepjpg]]>
        // </Filename>
        //
        // It should be like this:
        // <Filename><![CDATA[elsokepjpg]]></Filename>
        //
        // Also `<Version>8</Version>` must be used it is the version of all the uploaded files.
        // A single image cannot be updated in Unas with the setProduct api. Only all the images
        // at once can be updated with this version.
        //
        // <Type>base|alt</Type> also important, unas wont update the images without this tag.

        const builder = new XMLBuilder({ ignoreAttributes: false, format: false, indentBy: "", cdataPropName: "#cdata" });

        const request: ISetProductRequest = {
            Products: {
                Product: productElements,
            },
        };

        const productsXML = builder.build(request);
        return '<?xml version="1.0" encoding="UTF-8"?>\n' + productsXML;
    }

    createProductElement(
        sku: string,
        description: IDescriptionElement | undefined,
        stocks: IStockElement[] | undefined,
        params: IParamElement[] | undefined,
        images: IImagesElement | undefined,
        datas: IDataElement[] | undefined,
    ): IProductElement {
        return {
            Sku: sku,
            Action: "modify",
            Description: description,
            Stocks: stocks ? { Status: { Active: 1 }, Stock: stocks } : undefined,
            Params: params ? { Param: params } : undefined,
            Images: images,
            Datas: datas ? { Datas: datas } : undefined,
        };
    }

    createDescriptionElement(description: string): IDescriptionElement {
        return {
            Long: { "#cdata": description },
        };
    }

    createStockElement(stockDtos: StockDto[]): IStockElement[] {
        const result: IStockElement[] = [];
        for (const stockDto of stockDtos) {
            if (stockDto.quantity === undefined || stockDto.quantity === null || !stockDto.warehouseId) {
                throw new Error("StockDto is missing quantity or warehouseId");
            }
            // The default internal warehouse has no Unas id, internally in stock sprite it has an id 1.
            const warehouseId = stockDto.warehouseId == 1 ? undefined : stockDto.warehouseId;
            result.push({ WarehouseId: warehouseId, IsActive: "yes", Qty: stockDto.quantity });
        }
        return result;
    }

    createDataElement(dataDtos: DataDto[]): IDataElement[] {
        const result: IDataElement[] = [];
        for (const dataDto of dataDtos) {
            if (dataDto.value === undefined || dataDto.value === null || !dataDto.id) {
                throw new Error("DataDto is missing value or id");
            }
            const name = dataDto.name ? dataDto.name : "";
            result.push({ Id: dataDto.id, Name: { "#cdata": name }, Value: { "#cdata": dataDto.value } });
        }
        return result;
    }

    createParamElement(description: UnasParamType, image: UnasParamType): IParamElement {
        return {
            Name: STOCKSPRITE_UNAS_PARAM_NAME,
            Value: { "#cdata": `${STOCKSPRITE_UNAS_PARAM_DESCRIPTION}:${description},${STOCKSPRITE_UNAS_PARAM_IMAGES}:${image}` },
        };
    }

    createImagesElement(defaultFilename: string, defaultAlt: string, og: number, version: string, images: IImageElement[]): IImagesElement {
        // There is a strict restrition about how many times the images can be updated fro a product:
        // https://unas.hu/tudastar/api/termekek-adatszerkezet#imagesversion
        // Ha 5 alkalommal küldtél már kép verziót, azt követően hetente egyszer fogjuk csak feldolgozni a kép verzió frissítést.
        // Ha 10 alkalommal volt már kép verzió megadás, azt követően két hetente egyszer dolgozzuk fel a kérést.
        // Ha 15 alkalommal volt kép verzió megadva, havonta egyszer dolgozzuk fel kérést.
        // Ha 20 alkalom vagy annál többször, úgy pedig csak kéthavonta egyszer dolgozzuk fel a képfrissítési kérést.
        // A felsorolt limitációkat termékenként kell értelmezni.

        // For testing image uploads delete the test product and recreate it with the same data and sku.
        // This will reset the image upload count for the product.

        return {
            DefaultFilename: { "#cdata": defaultFilename },
            DefaultAlt: { "#cdata": defaultAlt },
            OG: og,
            Version: version,
            Image: images,
        };
    }

    createImageElement(type: "base" | "alt", id: number, sefUrl: string, filename: string, alt: string, importUrl: string): IImageElement {
        return {
            Type: type,
            Id: id,
            SefUrl: { "#cdata": sefUrl },
            Filename: { "#cdata": filename },
            Alt: { "#cdata": alt },
            Import: { Url: importUrl },
        };
    }
}
