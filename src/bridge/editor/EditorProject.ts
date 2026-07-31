import type { EditorProjectFile } from "../../../electron/contract/editor/EditorProjectFile";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import type { ResourceSchema } from "~/engine/pack/schema/ResourceSchema";
import type { GameDiagnosticsSchema } from "~/engine/validation/schema/GameDiagnosticsSchema";
import type { EditorProjectDescriptor } from "~/bridge/editor/EditorProjectDescriptor";

/** One canonical editor project backed by its loaded in-memory file index. */
export interface EditorProject extends EditorProjectDescriptor {
	readonly revision: string;
	readonly fileIndex: Readonly<Record<string, EditorProjectFile>>;
	readonly itemSourcePaths: Readonly<Record<string, string>>;
	readonly config?: GameConfigSchema.Type;
	readonly resources: ReadonlyArray<ResourceSchema.Type>;
	readonly resourceSourcePaths: Readonly<Record<string, string>>;
	readonly diagnostics: GameDiagnosticsSchema.Type;
}
