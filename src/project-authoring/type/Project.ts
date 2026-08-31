import type { ProjectDescriptor } from "~/project-authoring/schema/ProjectDescriptorSchema";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { ResourceSchema } from "~/game-config-resource/schema/ResourceSchema";

/** Canonical project-row commit excluding separately stored resource bodies. */
export interface ProjectCommit extends ProjectDescriptor {
	readonly previousRevision: number;
	readonly revision: number;
	readonly config: GameConfigSchema.Type;
}

/** One canonical editor project materialized from the editor repository. */
export interface Project extends ProjectDescriptor {
	readonly revision: number;
	readonly config: GameConfigSchema.Type;
	readonly resources: ReadonlyArray<ResourceSchema.Type>;
}
