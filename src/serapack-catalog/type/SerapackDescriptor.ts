import type { SerapackProvenanceSchema } from "~/serapack-artifact/schema/SerapackProvenanceSchema";
import type { SerakkiVersionSchema } from "~/application-version/schema/SerakkiVersionSchema";
import type { VersionSchema as GameVersionSchema } from "~/game-version/schema/VersionSchema";

type SerapackSource = "bundled" | "user";

/** Descriptor derived from a validated package payload and its soft release provenance. */
export interface SerapackDescriptor {
	readonly packageId: string;
	readonly contentHash: string;
	readonly title: string;
	readonly version: GameVersionSchema.Type;
	readonly serakki: SerakkiVersionSchema.Type;
	readonly projectRevision: number;
	readonly provenance: SerapackProvenanceSchema.Type;
	readonly source: SerapackSource;
	readonly overridesBundled?: boolean;
	readonly filename?: string;
}
