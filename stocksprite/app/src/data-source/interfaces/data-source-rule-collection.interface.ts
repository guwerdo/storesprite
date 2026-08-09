import { AdditionalOperation, RulesLogic } from "json-logic-js";

export interface IDataSourceRuleCollection {
    get(id: string): RulesLogic<AdditionalOperation>;
}
