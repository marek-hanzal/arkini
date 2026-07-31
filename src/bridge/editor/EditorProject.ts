import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import type { ResourceSchema } from "~/engine/pack/schema/ResourceSchema";
import type { GameDiagnosticsSchema } from "~/engine/validation/schema/GameDiagnosticsSchema";
import type { EditorProjectDescriptor } from "~/bridge/editor/EditorProjectDescriptor";

/** One manifest-backed editor project with an optional compiled game source snapshot. */
export interface EditorProject extends EditorProjectDescriptor {
	readonly revision: string;
	readonly config?: GameConfigSchema.Type;
	readonly resources: ReadonlyArray<ResourceSchema.Type>;
	readonly resourceSourcePaths: Readonly<Record<string, string>>;
	readonly diagnostics: GameDiagnosticsSchema.Type;
}
