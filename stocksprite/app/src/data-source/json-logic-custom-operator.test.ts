import jsonLogic from "json-logic-js";
import { beforeAll, describe, expect, it } from "vitest";

import { customLogicOperators } from "./json-logic-custom-operator.js";

describe("json-logic-custom-operator", () => {
    beforeAll(() => {
        customLogicOperators();
    });

    describe("uppercase operator", () => {
        it("should convert a string to uppercase", () => {
            const result = jsonLogic.apply({ uppercase: "hello" }, {}) as string;
            expect(result).toBe("HELLO");
        });

        it("should handle uppercase strings", () => {
            const result = jsonLogic.apply({ uppercase: "WORLD" }, {}) as string;
            expect(result).toBe("WORLD");
        });

        it("should handle mixed case strings", () => {
            const result = jsonLogic.apply({ uppercase: "HeLLo WoRLd" }, {}) as string;
            expect(result).toBe("HELLO WORLD");
        });

        it("should return empty string for non-string input", () => {
            const result = jsonLogic.apply({ uppercase: 123 }, {}) as string;
            expect(result).toBe("");
        });

        it("should return empty string for null input", () => {
            const result = jsonLogic.apply({ uppercase: null }, {}) as string;
            expect(result).toBe("");
        });

        it("should return empty string for undefined input", () => {
            const result = jsonLogic.apply({ uppercase: undefined }, {}) as string;
            expect(result).toBe("");
        });

        it("should work with data variables", () => {
            const result = jsonLogic.apply({ uppercase: { var: "name" } }, { name: "john" }) as string;
            expect(result).toBe("JOHN");
        });

        it("should handle empty strings", () => {
            const result = jsonLogic.apply({ uppercase: "" }, {}) as string;
            expect(result).toBe("");
        });

        it("should handle special characters", () => {
            const result = jsonLogic.apply({ uppercase: "hello@world!" }, {}) as string;
            expect(result).toBe("HELLO@WORLD!");
        });
    });

    describe("replace-all operator", () => {
        it("should replace characters in a string", () => {
            const result = jsonLogic.apply({ "replace-all": ["hello world", "o", "0"] }, {}) as string;
            expect(result).toBe("hell0 w0rld");
        });

        it("should handle multiple occurrences of the character", () => {
            const result = jsonLogic.apply({ "replace-all": ["banana", "a", "o"] }, {}) as string;
            expect(result).toBe("bonono");
        });

        it("should return the original string if the character to replace is not found", () => {
            const result = jsonLogic.apply({ "replace-all": ["hello world", "x", "y"] }, {}) as string;
            expect(result).toBe("hello world");
        });

        it("should return empty string for null input", () => {
            const result = jsonLogic.apply({ "replace-all": [null, "a", "b"] }, {}) as string;
            expect(result).toBe("");
        });

        it("should return empty string for undefined input", () => {
            const result = jsonLogic.apply({ "replace-all": [undefined, "a", "b"] }, {}) as string;
            expect(result).toBe("");
        });

        it("should work with data variables", () => {
            const result = jsonLogic.apply({ "replace-all": [{ var: "text" }, "e", "3"] }, { text: "hello" }) as string;
            expect(result).toBe("h3llo");
        });

        it("should handle empty strings", () => {
            const result = jsonLogic.apply({ "replace-all": ["", "a", "b"] }, {}) as string;
            expect(result).toBe("");
        });

        it("should handle special characters", () => {
            const result = jsonLogic.apply({ "replace-all": ["hello@world!", "@", "#"] }, {}) as string;
            expect(result).toBe("hello#world!");
        });

        it("should replace spaces with underscores", () => {
            const result = jsonLogic.apply({ "replace-all": ["hello world", " ", "_"] }, {}) as string;
            expect(result).toBe("hello_world");
        });

        it("should replace || with underscores", () => {
            const result = jsonLogic.apply({ "replace-all": ["hello||world", "||", "_"] }, {}) as string;
            expect(result).toBe("hello_world");
        });
    });

    describe("starts-with-number operator", () => {
        it("should return true if the string starts with a number", () => {
            const result = jsonLogic.apply({ "starts-with-number": "1abc" }, {}) as boolean;
            expect(result).toBe(true);
        });

        it("should return true if the string starts with zero", () => {
            const result = jsonLogic.apply({ "starts-with-number": "0abc" }, {}) as boolean;
            expect(result).toBe(true);
        });

        it("should return false if the string does not start with a number", () => {
            const result = jsonLogic.apply({ "starts-with-number": "abc1" }, {}) as boolean;
            expect(result).toBe(false);
        });

        it("should return false for empty strings", () => {
            const result = jsonLogic.apply({ "starts-with-number": "" }, {}) as boolean;
            expect(result).toBe(false);
        });

        it("should return false for non-string input", () => {
            const result = jsonLogic.apply({ "starts-with-number": 123 }, {}) as boolean;
            expect(result).toBe(false);
        });

        it("should return false for null input", () => {
            const result = jsonLogic.apply({ "starts-with-number": null }, {}) as boolean;
            expect(result).toBe(false);
        });

        it("should return false for undefined input", () => {
            const result = jsonLogic.apply({ "starts-with-number": undefined }, {}) as boolean;
            expect(result).toBe(false);
        });

        it("should work with data variables", () => {
            const result = jsonLogic.apply({ "starts-with-number": { var: "text" } }, { text: "2abc" }) as boolean;
            expect(result).toBe(true);
        });

        it("should handle strings with leading whitespace", () => {
            const result = jsonLogic.apply({ "starts-with-number": "   3abc" }, {}) as boolean;
            expect(result).toBe(true);
        });
    });

    describe("numbers-only operator", () => {
        it("should return only numbers from a string", () => {
            const result = jsonLogic.apply({ "numbers-only": "abc123def456" }, {}) as string;
            expect(result).toBe("123456");
        });

        it("should return an empty string if there are no numbers", () => {
            const result = jsonLogic.apply({ "numbers-only": "abcdef" }, {}) as string;
            expect(result).toBe("");
        });

        it("should return an empty string for null input", () => {
            const result = jsonLogic.apply({ "numbers-only": null }, {}) as string;
            expect(result).toBe("");
        });

        it("should return an empty string for undefined input", () => {
            const result = jsonLogic.apply({ "numbers-only": undefined }, {}) as string;
            expect(result).toBe("");
        });

        it("should work with data variables", () => {
            const result = jsonLogic.apply({ "numbers-only": { var: "text" } }, { text: "a1b2c3" }) as string;
            expect(result).toBe("123");
        });

        it("should handle strings with only numbers", () => {
            const result = jsonLogic.apply({ "numbers-only": "123456" }, {}) as string;
            expect(result).toBe("123456");
        });

        it("should handle strings with special characters", () => {
            const result = jsonLogic.apply({ "numbers-only": "a1!b2@c3#" }, {}) as string;
            expect(result).toBe("123");
        });

        it("should handle strings with single leading zeros", () => {
            const result = jsonLogic.apply({ "numbers-only": "0 db" }, {}) as string;
            expect(result).toBe("0");
        });

        it("should handle strings with interval like pattern", () => {
            const result = jsonLogic.apply({ "numbers-only": "0 - 5 db" }, {}) as string;
            expect(result).toBe("05");
        });

        it("should handle strings with interval like pattern", () => {
            const result = jsonLogic.apply({ "numbers-only": "100 - 500 db" }, {}) as string;
            expect(result).toBe("100500");
        });
    });

    describe("is-numeric operator", () => {
        it("should return true for numeric strings", () => {
            const result = jsonLogic.apply({ "is-numeric": "123" }, {}) as boolean;
            expect(result).toBe(true);
        });

        it("should return true for numeric strings with decimals", () => {
            const result = jsonLogic.apply({ "is-numeric": "123.45" }, {}) as boolean;
            expect(result).toBe(true);
        });

        it("should return false for non-numeric strings", () => {
            const result = jsonLogic.apply({ "is-numeric": "abc" }, {}) as boolean;
            expect(result).toBe(false);
        });

        it("should return false for empty strings", () => {
            const result = jsonLogic.apply({ "is-numeric": "" }, {}) as boolean;
            expect(result).toBe(false);
        });

        it("should return false for null input", () => {
            const result = jsonLogic.apply({ "is-numeric": null }, {}) as boolean;
            expect(result).toBe(false);
        });

        it("should return false for undefined input", () => {
            const result = jsonLogic.apply({ "is-numeric": undefined }, {}) as boolean;
            expect(result).toBe(false);
        });

        it("should work with data variables", () => {
            const result = jsonLogic.apply({ "is-numeric": { var: "value" } }, { value: "123" }) as boolean;
            expect(result).toBe(true);
        });

        it("should return false for strings with leading/trailing whitespace", () => {
            const result = jsonLogic.apply({ "is-numeric": "  123  " }, {}) as boolean;
            expect(result).toBe(true);
        });
    });

    describe("is-date operator", () => {
        const dateFormat = "yyyy.MM.dd";

        it("should return true for valid date strings", () => {
            const result = jsonLogic.apply({ "is-date": ["2024.06.01", dateFormat] }, {}) as boolean;
            expect(result).toBe(true);
        });

        it("should return false for invalid date strings", () => {
            const result = jsonLogic.apply({ "is-date": ["2024.13.01", dateFormat] }, {}) as boolean;
            expect(result).toBe(false);
        });

        it("should return false for non-date strings", () => {
            const result = jsonLogic.apply({ "is-date": ["not a date", dateFormat] }, {}) as boolean;
            expect(result).toBe(false);
        });

        it("should return false for empty strings", () => {
            const result = jsonLogic.apply({ "is-date": ["", dateFormat] }, {}) as boolean;
            expect(result).toBe(false);
        });

        it("should return false for null input", () => {
            const result = jsonLogic.apply({ "is-date": [null, dateFormat] }, {}) as boolean;
            expect(result).toBe(false);
        });

        it("should return false for undefined input", () => {
            const result = jsonLogic.apply({ "is-date": [undefined, dateFormat] }, {}) as boolean;
            expect(result).toBe(false);
        });

        it("should work with data variables", () => {
            const result = jsonLogic.apply({ "is-date": [{ var: "date" }, dateFormat] }, { date: "2024.06.01" }) as boolean;
            expect(result).toBe(true);
        });
    });

    describe("is-before-date operator", () => {
        const now = new Date("2025-12-16");
        const dateFormat = "yyyy.MM.dd";

        it("should return true for past date strings", () => {
            const result = jsonLogic.apply({ "is-before-date": ["2020.01.01", dateFormat, now] }, {}) as boolean;
            expect(result).toBe(true);
        });

        it("should return false for future date strings", () => {
            const result = jsonLogic.apply({ "is-before-date": ["2030.01.01", dateFormat, now] }, {}) as boolean;
            expect(result).toBe(false);
        });

        it("should return false for non-date strings", () => {
            const result = jsonLogic.apply({ "is-before-date": ["not a date", dateFormat, now] }, {}) as boolean;
            expect(result).toBe(false);
        });

        it("should return false for empty strings", () => {
            const result = jsonLogic.apply({ "is-before-date": ["", dateFormat, now] }, {}) as boolean;
            expect(result).toBe(false);
        });

        it("should return false for null input", () => {
            const result = jsonLogic.apply({ "is-before-date": [null, dateFormat, now] }, {}) as boolean;
            expect(result).toBe(false);
        });

        it("should return false for undefined input", () => {
            const result = jsonLogic.apply({ "is-before-date": [undefined, dateFormat, now] }, {}) as boolean;
            expect(result).toBe(false);
        });

        it("should work with data variables", () => {
            const result = jsonLogic.apply({ "is-before-date": [{ var: "date" }, dateFormat, now] }, { date: "2020.01.01" }) as boolean;
            expect(result).toBe(true);
        });
    });
});
