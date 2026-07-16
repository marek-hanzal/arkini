import type { PayloadSchema } from "~/engine/pack/schema/PayloadSchema";

export type ArkpackSource = "built-in" | "imported";

/** Stable catalog metadata for one playable Arkini package. */
export interface ArkpackDescriptor {
	readonly packageId: string;
	readonly contentHash: string;
	readonly gameId: string;
	readonly title: string;
	readonly configVersion: string;
	readonly source: ArkpackSource;
	readonly filename?: string;
	readonly importedAtMs?: number;
}

/** One fully validated package ready to create a live game. */
export interface LoadedArkpack {
	readonly descriptor: ArkpackDescriptor;
	readonly payload: PayloadSchema.Type;
}

/** Persisted imported package record. */
export interface StoredArkpackRecord extends ArkpackDescriptor {
	readonly bytes: ArrayBuffer;
}
