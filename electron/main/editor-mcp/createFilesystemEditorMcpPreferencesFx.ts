import { FileSystem } from "effect";
import { Effect, Semaphore } from "effect";
import { join } from "node:path";

import { EditorMcpPortSchema } from "../../contract/editor/EditorMcpPortSchema";
import { readElectronPreferenceFx } from "../preference/readElectronPreferenceFx";
import { writeElectronPreferenceFx } from "../preference/writeElectronPreferenceFx";
import type { EditorMcpPreferences } from "./EditorMcpPreferences";

export const DefaultEditorMcpPort = 32_310;

export namespace createFilesystemEditorMcpPreferencesFx {
	export interface Props {
		readonly root: string;
		readonly fileSystem?: FileSystem.FileSystem;
	}
}

/** Owns the global MCP port independently from editor database readiness. */
export const createFilesystemEditorMcpPreferencesFx = Effect.fn(
	"createFilesystemEditorMcpPreferencesFx",
)(function* ({ root, fileSystem: provided }: createFilesystemEditorMcpPreferencesFx.Props) {
	const fileSystem = provided ?? (yield* FileSystem.FileSystem);
	const currentPath = join(root, "editor-mcp.port");
	const writeSemaphore = yield* Semaphore.make(1);
	return {
		readPortFx: readElectronPreferenceFx({
			fileSystem,
			path: currentPath,
			fallback: DefaultEditorMcpPort,
			operation: "read the editor MCP port preference",
			parse: (stored) => EditorMcpPortSchema.safeParse(Number(stored.trim())).data,
		}),
		writePortFx: (candidate) =>
			writeSemaphore.withPermits(1)(
				writeElectronPreferenceFx({
					root,
					fileSystem,
					pendingPath: join(root, "editor-mcp.pending"),
					currentPath,
					value: candidate,
					operation: "persist the editor MCP port preference",
					serialize: (value) => String(EditorMcpPortSchema.parse(value)),
				}),
			),
	} satisfies EditorMcpPreferences;
});
