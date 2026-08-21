import { AppFile } from "../utils/file-path-util.js";
import { Util } from "../utils/index.js";
import { loadJson } from "../utils/json-util.js";
import { IDataSourceRuleProvider } from "./interfaces/data-source-rule-provider.interface.js";

export class DataSourceRuleProvider implements IDataSourceRuleProvider {
    getJsonRules(): unknown {
        const dataSourcePath = Util.getAppFilePath(AppFile.DATA_SOURCE_RULES);
        return loadJson(dataSourcePath);
    }
}
