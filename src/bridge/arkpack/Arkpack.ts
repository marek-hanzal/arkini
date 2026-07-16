import type { PayloadSchema } from "~/engine/pack/schema/PayloadSchema";

export type ArkpackSource = "built-in" | "imported";

/** Stable metadata used by the package catalog without reading package payload bytes. */
export interface ArkpackDescriptor {
	readonly packageId: string;
	readonly contentHash: string;
	readonly gameId: string;
	readonly title: string;
	readonly configVersion: string;
	readonly compressedSize: number;
	readonly source: ArkpackSource;
	readonly filename?: string;
	readonly importedAtMs?: number;
}

/** One fully validated package ready to create a live game. */
export interface LoadedArkpack {
	readonly descriptor: ArkpackDescriptor;
	readonly payload: PayloadSchema.Type;
}
