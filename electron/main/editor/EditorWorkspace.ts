import type { Effect } from "effect";
import type { EditorProjectManifest } from "../../contract/editor/EditorProjectManifest";
import type { EditorProjectRecord } from "../../contract/editor/EditorProjectRecord";

/** Narrow filesystem authority for projects contained by the Arkini editor root. */
export interface EditorWorkspace {
	readonly listFx: () => Effect.Effect<ReadonlyArray<EditorProjectManifest>, unknown>;
	readonly createFx: (record: EditorProjectRecord) => Effect.Effect<void, unknown>;
	readonly readFx: (projectId: string) => Effect.Effect<EditorProjectRecord | null, unknown>;
	readonly openDirectoryFx: (projectId?: string) => Effect.Effect<void, unknown>;
}
