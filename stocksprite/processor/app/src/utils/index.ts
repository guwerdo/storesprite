import { b64Decode, b64Encode } from "./base64-util.js";
import { getCurrentUtcDate } from "./date-util.js";
import { getCurrentEnvironment } from "./env-util.js";
import { stringifyError } from "./error-util.js";
import { AppFile, getAppFilePath } from "./file-path-util.js";
import { createShortHash } from "./hash-util.js";
import { loadJson, loadJsonSchema } from "./json-util.js";
import { getNumberValue, getStringValue, isObject, negativeToZero } from "./mapping.util.js";
import { sanitize } from "./sanitize-util.js";
import { getUnasApiKey } from "./secret-util.js";
import { getFileNameFromUrl, isValidUrl } from "./url-util.js";

export * from "../data-source/interfaces/data-source-rule-provider.interface.js";
export const Util = {
    getCurrentUtcDate,
    getCurrentEnvironment,
    createShortHash,
    b64Encode,
    b64Decode,
    getFileNameFromUrl,
    isValidUrl,
    sanitize,
    getUnasApiKey,
    stringifyError,
    loadJsonSchema,
    loadJson,
    getAppFilePath,
    AppFile,
    mapping: {
        getNumberValue,
        getStringValue,
        negativeToZero,
        isObject,
    },
};
