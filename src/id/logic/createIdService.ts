import type { DateService } from "~/date/context/DateServiceFx";
import type { IdService } from "~/id/context/IdServiceFx";

export function createIdService(date: DateService): IdService {
	const prefixed = (prefix: string) => {
		return `${prefix}:${date.nowMs().toString(36)}:${crypto.randomUUID()}`;
	};

	return {
		uuid() {
			return crypto.randomUUID();
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
