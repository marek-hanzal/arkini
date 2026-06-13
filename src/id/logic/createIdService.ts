import type { IdService } from "~/id/context/IdServiceFx";
import { genId } from "~/shared/genId";

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
		playerInventoryVirtual() {
			return prefixed("player-inventory:virtual");
		},
	};
}
