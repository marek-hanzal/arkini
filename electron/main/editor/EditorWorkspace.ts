import type { Effect } from "effect";
import type { EditorProjectManifest } from "../../contract/editor/EditorProjectManifest";
import type { EditorProjectFileWrite } from "../../contract/editor/EditorProjectFileWrite";
import type {
	EditorProjectCreate,
	EditorProjectRecord,
} from "../../contract/editor/EditorProjectRecord";

/** Narrow filesystem authority for projects contained by the Arkini editor root. */
export interface EditorWorkspace {
	readonly listFx: () => Effect.Effect<ReadonlyArray<EditorProjectManifest>, unknown>;
	readonly createFx: (record: EditorProjectCreate) => Effect.Effect<void, unknown>;
	readonly readFx: (projectId: string) => Effect.Effect<EditorProjectRecord | null, unknown>;
	readonly writeFileFx: (mutation: EditorProjectFileWrite) => Effect.Effect<string, unknown>;
	readonly openDirectoryFx: (projectId?: string) => Effect.Effect<void, unknown>;
}
