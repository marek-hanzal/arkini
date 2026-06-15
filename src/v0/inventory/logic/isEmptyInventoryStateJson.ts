import { emptyInventoryStateJson } from "./emptyInventoryStateJson";
import { normalizeInventoryStateJson } from "./normalizeInventoryStateJson";

export const isEmptyInventoryStateJson = (stateJson: string | undefined) =>
	normalizeInventoryStateJson(stateJson) === emptyInventoryStateJson;
