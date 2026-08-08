import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import type { ResourceSchema } from "~/engine/pack/schema/ResourceSchema";
import type { EditorProjectDescriptor } from "~/bridge/editor/EditorProjectDescriptor";

/** Canonical project-row commit excluding separately stored resource bodies. */
export interface EditorProjectCommit extends EditorProjectDescriptor {
	readonly revision: number;
	readonly config: GameConfigSchema.Type;
}

/** One canonical editor project materialized from the IndexedDB repository. */
export interface EditorProject extends EditorProjectCommit {
	readonly resources: ReadonlyArray<ResourceSchema.Type>;
}
