import { isBefore, isValid, parse } from "date-fns";
import jsonLogic from "json-logic-js";

export const customLogicOperators = () => {
    jsonLogic.add_operation("uppercase", (value: string): string => {
        if (typeof value !== "string") {
            return "";
        }
        return value.toUpperCase();
    });

    jsonLogic.add_operation("replace-all", (value: string, charToReplace: string, charToReplaceWith: string): string => {
        if (typeof value !== "string") {
            return "";
        }
        return value.replaceAll(charToReplace, charToReplaceWith);
    });

    jsonLogic.add_operation("starts-with-number", (value: string): boolean => {
        if (typeof value !== "string") {
            return false;
        }
        return /^\d/.test(value.trim());
    });

    jsonLogic.add_operation("numbers-only", (value: string): string => {
        if (typeof value !== "string") {
            return "";
        }
        return value.replace(/\D/g, "");
    });

    jsonLogic.add_operation("is-numeric", (value: string): boolean => {
        return Number.isFinite(parseFloat(value));
    });

    jsonLogic.add_operation("is-date", (value: string, format: string): boolean => {
        if (typeof value !== "string") {
            return false;
        }
        const parsedDate = parse(value, format, new Date());
        return isValid(parsedDate) && value.startsWith(parsedDate.getFullYear().toString());
    });

    jsonLogic.add_operation("is-before-date", (value: string, format: string, now: Date = new Date()): boolean => {
        if (typeof value !== "string") {
            return false;
        }
        const parsedDate = parse(value, format, now);
        return isValid(parsedDate) && isBefore(parsedDate, now);
    });

    jsonLogic.add_operation("get-median", (value: string): number => {
        // Basic validation for null, undefined, or empty string
        if (!value) return 0;

        // Split by the dash and extract digits from each part
        const parts = value.split("-");

        const numbers = parts
            .map((part) => {
                const match = part.match(/\d+/);
                return match ? parseInt(match[0], 10) : null;
            })
            .filter((num): num is number => num !== null);

        if (numbers.length === 0) return 0;

        // Handle single numeric values (e.g. "4" or "4 db").
        if (numbers.length === 1) return numbers[0];

        // For intervals, use first two parsed values and round median.
        const [min, max] = numbers;
        return Math.round((min + max) / 2);
    });
};
