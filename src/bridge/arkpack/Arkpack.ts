import type { ArkpackTrustSchema } from "~/engine/pack/schema/ArkpackTrustSchema";

type ArkpackSource = "built-in" | "imported";

/** Stable metadata used by the package catalog without reading package payload bytes. */
export interface ArkpackDescriptor {
	readonly packageId: string;
	readonly hash: string;
	readonly gameId: string;
	readonly title: string;
	readonly game: string;
	readonly trust: ArkpackTrustSchema.Type;
	readonly source: ArkpackSource;
	readonly filename?: string;
	readonly importedAtMs?: number;
}
