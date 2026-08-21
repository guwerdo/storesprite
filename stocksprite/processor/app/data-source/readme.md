# Generate JSON schema for IDataSource

Run to generate the json schema from type: `npx ts-json-schema-generator --path ./src/data-source/interfaces/data-sources.type --type IDataSources -o ./data-source/data-source.schema.json`

Run to validate the `data-source.json` file against the created schema:
`tsx src/data-source/validate.ts`

# Notes

generate json schema manually from ts file
https://github.com/vega/ts-json-schema-generator

validate runtime the json file against the schema
https://github.com/ajv-validator/ajv

create the ts type from the json
