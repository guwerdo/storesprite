export function getFileNameFromUrl(url: string): string {
    try {
        const pathname = new URL(url).pathname;
        const segments = pathname.split("/");
        return segments.pop() || "";
    } catch {
        // fallback for invalid URLs
        const segments = url.split("/");
        return segments.pop() || "";
    }
}

export function isValidUrl(url: string): boolean {
    if (typeof url !== "string") return false;

    const value = url.trim();
    if (value.length === 0) return false;
    if (/\s/.test(value)) return false;

    try {
        const url = new URL(value);

        // Allow only http/https image URLs
        const protocol = url.protocol.toLowerCase();
        if (protocol !== "http:" && protocol !== "https:") return false;

        // Basic hostname presence check
        if (!url.hostname) return false;

        return true;
    } catch {
        return false;
    }
}
