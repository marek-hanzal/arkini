import type { GameProjectManifestSchema } from "~/game-config/source/schema/GameProjectManifestSchema";
import type { ResourceSchema } from "~/game-config/resource/schema/ResourceSchema";
import type { GameConfigSchema } from "~/game-config/GameConfigSchema";
import type { ArkpackVersionSchema } from "~/engine/version/schema/ArkpackVersionSchema";

/** Canonical current-tree data backed by one Editor project directory. */
export interface ProjectFiles {
	readonly arkpack: ArkpackVersionSchema.Type;
	readonly marker: GameProjectManifestSchema.Type;
	readonly config: GameConfigSchema.Type;
	readonly resources: ReadonlyArray<ResourceSchema.Type>;
}
