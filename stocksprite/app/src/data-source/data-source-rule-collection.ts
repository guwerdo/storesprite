import { inject } from "inversify";
import { BindingKeys } from "../types/binding-keys.js";
import { IDataSourceRuleCollection } from "./interfaces/data-source-rule-collection.interface.js";
import { IDataSourceRule } from "./interfaces/data-source-rule.interface.js";
import type { Logger } from "log4js";
import { AdditionalOperation, RulesLogic } from "json-logic-js";
import type { IDataSourceRuleProvider } from "./interfaces/data-source-rule-provider.interface.js";

export class DataSourceRuleCollection implements IDataSourceRuleCollection {
    rules: IDataSourceRule[] = [];

    constructor(
        @inject(BindingKeys.Logger) private _logger: Logger,
        @inject(BindingKeys.DataSourceRuleProvider) private _dataSourceRuleProvider: IDataSourceRuleProvider
    ) {
            this.init();
    }

    get(id: string): RulesLogic<AdditionalOperation> {
        const result = this.rules.find((r) => r.id === id);
        if (!result) {
            this._logger.error("Rule not found", { id });
            throw new Error(`Rule not found: ${id}`);
        }
        return result.rule as RulesLogic<AdditionalOperation>;
    }

    private init(): void {
        try {
            const rules = this._dataSourceRuleProvider.getJsonRules();
            
            if (!Array.isArray(rules)) {
                throw new Error("Parsed rules must be an array");
            }

            this.rules = rules as IDataSourceRule[];

            this._logger.info(`Loaded ${this.rules.length} data source rules`);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this._logger.error("Failed to initialize rules", { error: message });
            throw new Error(`Failed to initialize rules: ${message}`);
        }
    }
}
