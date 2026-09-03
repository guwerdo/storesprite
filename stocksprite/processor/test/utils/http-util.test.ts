import { afterEach, describe, expect, it, vi } from "vitest";
import axios from "axios";
import { extractErrorMessage } from "../../src/utils/http-util.js";

vi.mock("axios", () => ({ default: { isAxiosError: vi.fn() } }));

const isAxiosError = vi.mocked(axios.isAxiosError);

function axiosLikeError(shape: Record<string, unknown>): Error {
    return Object.assign(new Error("boom"), shape);
}

afterEach(() => {
    isAxiosError.mockReset();
    isAxiosError.mockReturnValue(false);
});

describe("http-util.extractErrorMessage", () => {
    it("prefers response.data.error for an axios error", () => {
        isAxiosError.mockReturnValue(true);
        expect(extractErrorMessage(axiosLikeError({ response: { data: { error: "backend says no" } } }))).toBe("backend says no");
    });

    it("prefers response.data.message when error is absent", () => {
        isAxiosError.mockReturnValue(true);
        expect(extractErrorMessage(axiosLikeError({ response: { data: { message: "msg text" } } }))).toBe("msg text");
    });

    it("falls back to HTTP status + message when there is no data body", () => {
        isAxiosError.mockReturnValue(true);
        expect(extractErrorMessage(axiosLikeError({ response: { status: 502 } }))).toBe("HTTP 502: boom");
    });

    it("uses the raw message when there is no response", () => {
        isAxiosError.mockReturnValue(true);
        expect(extractErrorMessage(axiosLikeError({ response: undefined }))).toBe("boom");
    });

    it("uses message for a plain (non-axios) Error", () => {
        expect(extractErrorMessage(new Error("plain"))).toBe("plain");
    });

    it("returns the fallback for unknown values", () => {
        expect(extractErrorMessage("some string")).toBe("Request failed");
    });
});
