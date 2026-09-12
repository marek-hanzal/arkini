import type { GameProjectManifestSchema } from "~/game-config-source/schema/GameProjectManifestSchema";
import type { ResourceSchema } from "~/game-config-resource/schema/ResourceSchema";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { VersionPartsSchema } from "~/game-version/schema/VersionPartsSchema";

/** Complete source payload for initial project creation or import, including PNG bodies. */
export interface ProjectFiles {
	readonly arkpack: VersionPartsSchema.Type;
	readonly marker: GameProjectManifestSchema.Type;
	readonly config: GameConfigSchema.Type;
	readonly resources: ReadonlyArray<ResourceSchema.Type>;
}
