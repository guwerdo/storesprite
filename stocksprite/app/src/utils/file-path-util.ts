import path from "path";
import { fileURLToPath } from "url";

export enum AppFile {
    DATA_SOURCE = "data-source.json",
    DATA_SOURCE_SCHEMA = "data-source.schema.json",
    PRODUCT_DTO_SCHEMA = "product-dto.schema.json",
}

export function getAppFilePath(file: AppFile): string {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const projectRoot = path.resolve(__dirname, "../..");
    switch (file) {
        case AppFile.DATA_SOURCE:
        case AppFile.DATA_SOURCE_SCHEMA:
        case AppFile.PRODUCT_DTO_SCHEMA:
            return path.join(projectRoot, "data-source", file);
        default: {
            // Exhaustive guard: if a new enum member is added and not handled above,
            // 'file' won’t be 'never' and this assignment will error at compile time.
            const _exhaustive: never = file;
            throw new Error("Unhandled AppFile value: " + String(_exhaustive));
        }
    }
}
