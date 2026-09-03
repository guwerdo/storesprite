import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig([
    globalIgnores(["node_modules/", "dist/"]),
    tseslint.configs.strict,
    tseslint.configs.stylistic,
    tseslint.configs.recommendedTypeChecked,
    {
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
        rules: {
            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                    vars: "all",
                    args: "after-used",
                    ignoreRestSiblings: true,
                    varsIgnorePattern: "^_$",
                    argsIgnorePattern: "^_$|^_[0-9]+$",
                    caughtErrors: "none",
                },
            ],
        },
    },
    {
        // vitest-mock-extended `mock<T>()` methods are stateless vi.fn()s — holding a
        // reference to one in `expect(mock.method)`/`.mockResolvedValue()` is the whole
        // idiom, so the `this`-scoping check `unbound-method` is a false positive here.
        files: ["**/*.test.ts", "**/*.test.tsx"],
        rules: {
            "@typescript-eslint/unbound-method": "off",
        },
    },
]);
