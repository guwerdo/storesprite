# Configuration System

This application uses a layered configuration system similar to .NET's `IConfiguration`, providing a flexible and testable way to manage application settings.

## Overview

The configuration system supports:

- **Layered configuration** from multiple sources (JSON files, environment variables, in-memory overrides)
- **Environment-specific overrides** (dev, test, prod)
- **Strongly-typed configuration sections** (similar to .NET's Options pattern)
- **Dependency injection** support via InversifyJS
- **Easy testing** with configuration overrides

## Configuration Loading Order

Configuration is loaded in the following order, with later sources overriding earlier ones:

1. `configuration/configuration.json` - Base configuration
2. `configuration/configuration.{environment}.json` - Environment-specific overrides (e.g., `configuration.test.json`)
3. Environment variables (with `CONFIG_` prefix)
4. In-memory overrides (useful for testing)

## Configuration Files

### Base Configuration (`configuration/configuration.json`)

Contains default settings for all environments:

```json
{
    "redis": {
        "connection": {
            "host": "redis-stack",
            "port": 6379
        }
    },
    "redis": {
        "connection": {
            "host": "redis-stack",
            "port": 6379
        }
    }
}
```

### Environment-Specific Configuration

- `configuration/configuration.dev.json` - Development settings
- `configuration/configuration.test.json` - Test settings (enables mocks)
- `configuration/configuration.production.json` - Production settings

Environment is determined by `NODE_ENV` environment variable (defaults to `dev`).

## Usage

### 1. Injecting IConfiguration into Classes

```typescript
import { injectable, inject } from "inversify";
import { IConfiguration } from "./config/index.js";
import { BindingKeys } from "./types/binding-keys.js";

@injectable()
class MyService {
    constructor(
        @inject(BindingKeys.IConfiguration) private config: IConfiguration
    ) {}

    doSomething() {
        // Get individual values with colon or dot notation
        const host = this.config.get<string>("redis:connection:host");
        const port = this.config.get<number>("redis.connection.port");

        // Get with default fallback
        const timeout = this.config.getOrDefault<number>("redis:timeout", 5000);

        // Get entire section as typed object
        const redisConfig = this.config.getSection<IRedisConfigSection>("redis");
        console.log(redisConfig.connection.host);
    }
}
```

### 2. Using Strongly-Typed Configuration Sections

```typescript
import { IRedisConfigSection } from "./config/configuration-sections.js";

// In your service constructor
const redisConfig = this.config.getSection<IRedisConfigSection>("redis");
```

### 3. Environment Variables

Set environment variables using double underscores for nested keys:

```bash
# Override Redis host
export CONFIG_REDIS__CONNECTION__HOST=my-redis-server

# Run your application
npm run parse:dev
```

### 4. Checking Configuration

```typescript
// Check if a key exists
if (this.config.has("redis:connection:host")) {
    // ...
}

// Get all configuration (for debugging)
const allConfig = this.config.getAll();
console.log(JSON.stringify(allConfig, null, 2));
```

## Testing

The new configuration system makes testing much easier by allowing you to override configuration on a per-test basis.

### Example: Testing with Custom Configuration

```typescript
import { Container } from "inversify";
import { beforeEach, describe, expect, it } from "vitest";

import { ConfigurationBuilder } from "./config/configuration-builder.js";
import { IConfiguration } from "./config/index.js";
import { BindingKeys } from "./types/binding-keys.js";

describe("MyService", () => {
    let testContainer: Container;
    let testConfig: IConfiguration;

    beforeEach(() => {
        testContainer = new Container();

        // Create test-specific configuration
        testConfig = new ConfigurationBuilder()
            .addInMemoryCollection({
                redis: { connection: { host: "test-redis", port: 6379 } },
            })
            .build();

        // Bind configuration to test container
        testContainer.bind<IConfiguration>(BindingKeys.IConfiguration).toConstantValue(testConfig);
        testContainer.bind<MyService>(MyService).toSelf();
    });

    it("should use test configuration", () => {
        const service = testContainer.get<MyService>(MyService);
        // Test with mocked dependencies
    });
});
```

### Example: Testing with Environment-Specific Configuration

```typescript
it("should load test environment configuration", () => {
    // Explicitly use 'test' environment (loads configuration.test.json)
    const testConfig = ConfigurationBuilder.createDefault({
        environment: "test",
    }).build();
});
```

## Migration Guide

### Migrating from Old Configuration System

**Old way (direct imports):**

```typescript
import { TEST_MODE, redisConfig } from "./config/config.js";

const host = redisConfig.connection.host;
if (TEST_MODE.UNAS.CLIENT_MOCK) {
    // ...
}
```

**New way (dependency injection):**

```typescript
import { injectable, inject } from "inversify";
import { IConfiguration } from "./config/index.js";
import { IRedisConfigSection } from "./config/configuration-sections.js";
import { BindingKeys } from "./types/binding-keys.js";

@injectable()
class MyService {
    constructor(
        @inject(BindingKeys.IConfiguration) private config: IConfiguration
    ) {}

    doSomething() {
        const redisConfig = this.config.getSection<IRedisConfigSection>("redis");
        const host = redisConfig.connection.host;
    }
}
```

**Backward Compatibility:**

The old exports in `config.ts` still work for a transition period, but they now load from the new configuration system:

```typescript
// These still work but are marked as DEPRECATED
import { TEST_MODE, redisConfig } from "./config/config.js";
```

## Benefits

1. **Environment-Aware**: Automatically loads correct configuration based on `NODE_ENV`
2. **Testable**: Easy to override configuration in tests without modifying global state
3. **Type-Safe**: Strongly-typed configuration sections with TypeScript interfaces
4. **Flexible**: Support multiple configuration sources with clear precedence rules
5. **Maintainable**: Configuration changes don't require code changes
6. **Familiar**: Similar to .NET's IConfiguration that many developers know

## Advanced Usage

### Creating Custom Configuration Builders

```typescript
const config = new ConfigurationBuilder()
    .addJsonFile("./my-custom-config.json", true)
    .addEnvironmentVariables("MY_CONFIG_")
    .addInMemoryCollection({ custom: { value: "test" } })
    .build();
```

### Using Configuration Builder Options

```typescript
const config = new ConfigurationBuilder({
    basePath: "/custom/path",
    environment: "staging",
    throwOnMissingFile: true,
})
    .addJsonFile("./config.json")
    .build();
```

### Adding Custom Configuration Sources

```typescript
import { IConfigurationSource } from "./config/interfaces/configuration.interface.js";

class CustomConfigSource implements IConfigurationSource {
    priority = 50;

    load(): Record<string, any> {
        // Load configuration from database, API, etc.
        return { custom: { data: "from-source" } };
    }
}

const config = new ConfigurationBuilder().addSource(new CustomConfigSource()).build();
```

## Running Tests

```bash
# Run configuration tests
npm test -- configuration.test.ts

# Run with test environment
NODE_ENV=test npm test
```
