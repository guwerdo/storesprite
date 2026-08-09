# GitHub Copilot Instructions

## Role
Act as an expert senior engineer with a focus on clean, maintainable, and type-safe code.

## Context
- Project name: `Stocksprite`
- Tech Stack: nodejs, typescript, docker, redis

## Coding Preferences
- Optimization: When suggesting changes, prioritize readability and performance to ensure code is both maintainable and efficient.
- Asynchronous Logic: Use async/await syntax exclusively for asynchronous functions; avoid using .then() chains.

### Building
When building the application run npm script: `npm run build:fast`

### Testing
Always include unit tests using Vitest for any new logic. Follow these structural requirements for all .test.ts files to ensure consistency and readability:

#### File Structure
- Top-Level Suite: Wrap the entire file in a describe block named after the class or module being tested.
- Method Suites: Within the main block, create a nested describe block for each individual method or function.

#### Test Case Formatting
Use the following descriptive pattern for individual it blocks:
`it("should <expected behavior> when <condition/trigger>", () => { ... });`

#### Implementation (AAA Pattern)
Organize the logic within each test using the Arrange-Act-Assert pattern, separated by comments:
- `// Arrange`: Set up the necessary data, mocks, and environment.
- `// Act`: Execute the specific method or action being tested.
- `// Assert`: Verify that the result matches the expected outcome.
    
### TypeScript
Use strict typing. Avoid `any` at all costs. Prefer interfaces over types. Make code `eslint` compatible.

### Git
Suggest concise, conventional commit messages. All commit message should start with the `stocksprite: ` prefix.

## Prohibited Patterns
- Do not use deprecated libraries like.
- Do not add comments that explain *what* the code is doing (the code should be self-explanatory); only explain *why*.