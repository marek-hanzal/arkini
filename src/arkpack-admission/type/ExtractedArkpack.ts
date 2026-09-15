import type { ArkpackProvenanceSchema } from "~/arkpack-artifact/schema/ArkpackProvenanceSchema";
import type { ArkiniVersionSchema } from "~/application-version/schema/ArkiniVersionSchema";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { VersionSchema as GameVersionSchema } from "~/game-version/schema/VersionSchema";
import type { ResourceTypeSchema } from "~/game-config-resource/schema/ResourceTypeSchema";

export interface ExtractedArkpackResource {
	readonly id: string;
	readonly type: ResourceTypeSchema.Type;
	readonly path: string;
	readonly size: number;
}

/** One validated Arkpack projected onto ordinary files without retaining binary bodies. */
export interface ExtractedArkpack {
	readonly arkini: ArkiniVersionSchema.Type;
	readonly config: GameConfigSchema.Type;
	readonly contentHash: string;
	readonly packageId: string;
	readonly provenance: ArkpackProvenanceSchema.Type;
	readonly resources: ReadonlyArray<ExtractedArkpackResource>;
	readonly version: GameVersionSchema.Type;
}
