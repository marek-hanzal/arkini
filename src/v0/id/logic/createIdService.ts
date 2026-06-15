import type { IdService } from "~/v0/id/context/IdServiceFx";
import { genId } from "~/v0/id/logic/genId";

export function createIdService(): IdService {
	const prefixed = (prefix: string) => `${prefix}:${genId()}`;

	return {
		uuid() {
			return genId();
		},
		prefixed,
		boardItem() {
			return prefixed("board");
		},
		inventoryVirtual() {
			return prefixed("inventory:virtual");
		},
	};
}
