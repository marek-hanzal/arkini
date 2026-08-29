import type { EditorProjectDescriptor } from "~/project-authoring/EditorProjectDescriptor";
import type { GameConfigSchema } from "~/game-config/GameConfigSchema";
import type { ResourceSchema } from "~/game-config/resource/schema/ResourceSchema";

/** Canonical project-row commit excluding separately stored resource bodies. */
export interface EditorProjectCommit extends EditorProjectDescriptor {
	readonly previousRevision: number;
	readonly revision: number;
	readonly config: GameConfigSchema.Type;
}

/** One canonical editor project materialized from the editor repository. */
export interface EditorProject extends EditorProjectDescriptor {
	readonly revision: number;
	readonly config: GameConfigSchema.Type;
	readonly resources: ReadonlyArray<ResourceSchema.Type>;
}
