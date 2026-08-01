import type { Effect } from "effect";
import type { EditorProjectManifest } from "../../../electron/contract/editor/EditorProjectManifest";
import type { EditorProjectWrite } from "../../../electron/contract/editor/EditorProjectWrite";
import type { EditorProjectWriteResult } from "../../../electron/contract/editor/EditorProjectWriteResult";
import type {
	EditorProjectCreate,
	EditorProjectRecord,
} from "../../../electron/contract/editor/EditorProjectRecord";

/** Renderer-side Effect adapter over the contained Electron editor workspace. */
export interface EditorWorkspace {
	readonly listFx: () => Effect.Effect<ReadonlyArray<EditorProjectManifest>, unknown>;
	readonly createFx: (record: EditorProjectCreate) => Effect.Effect<void, unknown>;
	readonly readFx: (projectId: string) => Effect.Effect<EditorProjectRecord | null, unknown>;
	readonly writeFx: (
		mutation: EditorProjectWrite,
	) => Effect.Effect<EditorProjectWriteResult, unknown>;
	readonly openDirectoryFx: (projectId?: string) => Effect.Effect<void, unknown>;
}
