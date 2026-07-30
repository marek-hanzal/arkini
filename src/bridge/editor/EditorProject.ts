import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import type { ResourceSchema } from "~/engine/pack/schema/ResourceSchema";
import type { GameDiagnosticsSchema } from "~/engine/validation/schema/GameDiagnosticsSchema";

/** One validated editor project snapshot compiled from standalone source files. */
export interface EditorProject {
	readonly projectId: string;
	readonly config: GameConfigSchema.Type;
	readonly resources: ReadonlyArray<ResourceSchema.Type>;
	readonly diagnostics: GameDiagnosticsSchema.Type;
}
