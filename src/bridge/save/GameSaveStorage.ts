import type { StateSchema } from "~/engine/state/schema/StateSchema";

export namespace GameSaveStorage {
	export interface Scope {
		readonly packageId: string;
		readonly contentHash: string;
	}

	export interface Write extends Scope {
		readonly state: StateSchema.Type;
	}
}

/** Durable save storage isolated from installed arkpack binaries. */
export interface GameSaveStorage {
	readonly close: () => void;
	readonly read: (scope: GameSaveStorage.Scope) => Promise<StateSchema.Type | null>;
	readonly remove: (packageId: string) => Promise<void>;
	readonly write: (record: GameSaveStorage.Write) => Promise<void>;
}
