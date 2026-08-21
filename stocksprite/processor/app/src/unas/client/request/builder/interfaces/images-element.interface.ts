import { IImageElement } from "./image-element.interface.js";

export interface IImagesElement {
    DefaultFilename: { "#cdata": string };
    DefaultAlt: { "#cdata": string };
    OG: number;
    Version: string;
    Image: IImageElement[];
}
