import axios from "axios";

/** Human-readable message for an axios/HTTP failure (`fallback` for anything else). */
export function extractErrorMessage(error: unknown, fallback = "Request failed"): string {
    if (axios.isAxiosError(error)) {
        const data = error.response?.data as { error?: string; message?: string } | undefined;
        const dataMessage = data?.error ?? data?.message;
        if (dataMessage) {
            return dataMessage;
        }
        if (error.response) {
            return `HTTP ${error.response.status}: ${error.message}`;
        }
        return error.message;
    }
    if (error instanceof Error) {
        return error.message;
    }
    return fallback;
}

export function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
