import { format, parse } from "date-fns";
import stringify from "fast-json-stable-stringify";

// These mapping functions should try to return a datatype for the ProductDto class
// Specifically, they should return the appropriate types for each field in the ProductDto
// ProductDto should try to use the returned values.

// Test mapping function
export function mapTest(fields) {
    console.log("Mapping function mapTest called with fields:", stringify(fields));
    return (fields["part"] ?? "").toUpperCase() + " + " + (fields["brand"] ?? "");
}

export function mapImages(fields) {
    const result = [];
    for (const [_, value] of Object.entries(fields)) {
        // Create an ImageDto
        if (value) {
            result.push({
                uri: value, // uri is manadatory for mapping
                fileName: helperGetFileNameFromUrl(value),
            });
        }
    }
    return result;
}

export function mapStocks(fields) {
    const result = [];
    for (const [_, value] of Object.entries(fields)) {
        // Create an ImageDto
        if (value) {
            result.push({
                uri: value, // uri is manadatory for mapping
                fileName: helperGetFileNameFromUrl(value),
            });
        }
    }
    return result;
}

export function mapMagicToolsSku(fields) {
    const sku = fields["Cikkszám"];
    if (sku) {
        return sku.replace(/ /g, "_");
    }
    return sku;
}

export function mapMagicToolsIncomingStockCount(fields) {
    const countStr = fields["Várható érkezés mennyiség"];
    const dateStr = fields["Várható érkezés dátum"];
    const parsedDate = parseMagicToolsDate(dateStr);

    if (!isParsedMagicToolsDateValid(parsedDate)) {
        return undefined;
    }

    if (isMagicToolsCountValid(countStr)) {
        return Number(countStr);
    }

    return undefined;
}

export function mapMagicToolsIncomingStockDate(fields) {
    const countStr = fields["Várható érkezés mennyiség"];
    const dateStr = fields["Várható érkezés dátum"];
    const parsedDate = parseMagicToolsDate(dateStr);

    if (!isMagicToolsCountValid(countStr)) {
        return undefined;
    }

    if (!isParsedMagicToolsDateValid(parsedDate)) {
        return undefined;
    }

    return format(parsedDate, "yyyy.MM.dd.");
}

function parseMagicToolsDate(dateStr) {
    const dateFormat = "yyyy.MM.dd";
    if (typeof dateStr !== "string" || dateStr.trim().length === 0) {
        return undefined;
    }
    const cleaned = dateStr.trim().replace(/\.$/, "");
    const parsedDate = parse(cleaned, dateFormat, new Date());
    if (isNaN(parsedDate.getTime())) {
        return undefined;
    }
    return parsedDate;
}

function isMagicToolsCountValid(countStr) {
    if (countStr.trim() === "") return undefined;
    const result = Number(countStr);
    return isNaN(result) ? false : true;
}

function isParsedMagicToolsDateValid(parsedDate) {
    if (!(parsedDate instanceof Date) || isNaN(parsedDate.getTime())) {
        return false;
    }

    // Compare by calendar day (ignore time)
    const day = new Date(parsedDate.getTime());
    const today = new Date();
    day.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    return day >= today;
}

// ------------ Helpers
function helperGetFileNameFromUrl(urlStr) {
    if (!urlStr) return undefined;

    const extract = (s) => {
        const withoutHashQuery = s.split("#")[0].split("?")[0];
        const segments = withoutHashQuery.split("/").filter(Boolean);
        if (segments.length === 0) return undefined;

        let last = segments[segments.length - 1];
        try {
            last = decodeURIComponent(last);
        } catch {
            /* ignore */
        }
        if (!last) return undefined;

        const dot = last.lastIndexOf(".");
        const base = dot > 0 ? last.slice(0, dot) : last;
        return base || undefined;
    };

    try {
        const u = new URL(urlStr);
        return extract(u.pathname);
    } catch {
        return extract(urlStr);
    }
}
