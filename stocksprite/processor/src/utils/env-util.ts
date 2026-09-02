export type CurrentEnvironment = "env" | "prod" | "dev" | "test";

export function getCurrentEnvironment(): CurrentEnvironment {
    const nodeEnvironment = process.env.NODE_ENV?.toLowerCase();

    if (nodeEnvironment === "prod" || nodeEnvironment === "production") {
        return "prod";
    }
    if (nodeEnvironment === "test") {
        return "test";
    }
    if (nodeEnvironment === "dev" || nodeEnvironment === "development") {
        return "dev";
    }
    return "env";
}
