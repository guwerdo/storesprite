import { UnasImageType } from "../../../../../types/unas-image.type.js";

export interface IImageElement {
    Type: UnasImageType;
    Id: number; // When Type is "alt", Id can be 1-9
    SefUrl: { "#cdata": string };
    Filename: { "#cdata": string };
    Alt: { "#cdata": string };
    Import: { Url: string };
}
