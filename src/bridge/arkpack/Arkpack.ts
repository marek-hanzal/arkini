import type { ArkpackTrustSchema } from "~/engine/pack/schema/ArkpackTrustSchema";

type ArkpackSource = "bundled" | "user";

/** Descriptor derived from a validated package payload and its detached signature. */
export interface ArkpackDescriptor {
	readonly packageId: string;
	readonly contentHash: string;
	readonly gameId: string;
	readonly title: string;
	readonly game: string;
	readonly trust: ArkpackTrustSchema.Type;
	readonly source: ArkpackSource;
	readonly overridesBundled?: boolean;
	readonly filename?: string;
}
