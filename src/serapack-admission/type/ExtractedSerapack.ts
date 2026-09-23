import type { SerapackProvenanceSchema } from "~/serapack-artifact/schema/SerapackProvenanceSchema";
import type { SerakkiVersionSchema } from "~/application-version/schema/SerakkiVersionSchema";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { VersionSchema as GameVersionSchema } from "~/game-version/schema/VersionSchema";
import type { ResourceTypeSchema } from "~/game-config-resource/schema/ResourceTypeSchema";

export interface ExtractedSerapackResource {
	readonly uid: string;
	readonly type: ResourceTypeSchema.Type;
	readonly path: string;
	readonly size: number;
}

/** One validated Serapack projected onto ordinary files without retaining binary bodies. */
export interface ExtractedSerapack {
	readonly serakki: SerakkiVersionSchema.Type;
	readonly config: GameConfigSchema.Type;
	readonly contentHash: string;
	readonly packageId: string;
	readonly provenance: SerapackProvenanceSchema.Type;
	readonly resources: ReadonlyArray<ExtractedSerapackResource>;
	readonly version: GameVersionSchema.Type;
	readonly projectRevision: number;
}
