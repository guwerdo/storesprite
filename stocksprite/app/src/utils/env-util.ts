export type CurrentEnvironment = "env" | "prod" | "dev" | "test";

export function getCurrentEnvironment(): CurrentEnvironment {
    const nodeEnvironment = process.env.NODE_ENV?.toLowerCase();

    if (!nodeEnvironment) {
        return "dev";
    }

    if (nodeEnvironment === "prod") {
        return "prod";
    }

    if (nodeEnvironment === "dev") {
        return "dev";
    }

    if (nodeEnvironment === "test") {
        return "test";
    }

    return "dev";
}
