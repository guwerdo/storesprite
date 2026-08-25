import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");

/** Read a golden fixture file (relative to test/fixtures). */
export function loadFixture(...segments: string[]): string {
    return readFileSync(join(fixturesDir, ...segments), "utf8");
}

/** Strip the XML prolog and collapse inter-tag whitespace so pretty and minified XML compare equal. */
export function normalizeXml(xml: string): string {
    return xml
        .replace(/<\?xml[^>]*\?>\s*/g, "")
        .replace(/>\s+</g, "><")
        .trim();
}
