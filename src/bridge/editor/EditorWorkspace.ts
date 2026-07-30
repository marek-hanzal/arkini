import type { Effect } from "effect";
import type { EditorProjectRecord } from "../../../electron/contract/editor/EditorProjectRecord";

/** Renderer-side Effect adapter over the contained Electron editor workspace. */
export interface EditorWorkspace {
	readonly createFx: (record: EditorProjectRecord) => Effect.Effect<void, unknown>;
	readonly readFx: (projectId: string) => Effect.Effect<EditorProjectRecord | null, unknown>;
	readonly openDirectoryFx: (projectId?: string) => Effect.Effect<void, unknown>;
}
