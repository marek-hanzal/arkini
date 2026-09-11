import type { GameProjectManifestSchema } from "~/game-config-source/schema/GameProjectManifestSchema";
import type { ResourceSchema } from "~/game-config-resource/schema/ResourceSchema";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { VersionPartsSchema } from "~/game-version/schema/VersionPartsSchema";

/** Canonical current-tree data backed by one Editor project directory. */
export interface ProjectFiles {
	readonly arkpack: VersionPartsSchema.Type;
	readonly marker: GameProjectManifestSchema.Type;
	readonly config: GameConfigSchema.Type;
	readonly resources: ReadonlyArray<ResourceSchema.Type>;
}
