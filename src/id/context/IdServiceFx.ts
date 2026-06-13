import { Context } from "effect";

export interface IdService {
	uuid(): string;
	prefixed(prefix: string): string;
	boardItem(): string;
	inventoryVirtual(): string;
	playerInventoryVirtual(): string;
}

export class IdServiceFx extends Context.Tag("IdServiceFx")<IdServiceFx, IdService>() {
	//
}
