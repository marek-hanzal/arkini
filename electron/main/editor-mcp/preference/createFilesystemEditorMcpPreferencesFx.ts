import { FileSystem } from "effect";
import { Effect, Semaphore } from "effect";
import { join } from "node:path";

import { EditorMcpNgrokSettingsSchema } from "../../../contract/editor/EditorMcpConfigurationSchema";
import { EditorMcpPortSchema } from "../../../contract/editor/EditorMcpPortSchema";
import { readElectronPreferenceFx } from "../../preference/readElectronPreferenceFx";
import { writeElectronPreferenceFx } from "../../preference/writeElectronPreferenceFx";
import type { EditorMcpPreferences } from "./EditorMcpPreferences";

export const DefaultEditorMcpPort = 32_310;

export namespace createFilesystemEditorMcpPreferencesFx {
	export interface Props {
		readonly root: string;
		readonly fileSystem?: FileSystem.FileSystem;
	}
}

/** Owns global MCP transport preferences independently from Editor repository readiness. */
export const createFilesystemEditorMcpPreferencesFx = Effect.fn(
	"createFilesystemEditorMcpPreferencesFx",
)(function* ({ root, fileSystem: provided }: createFilesystemEditorMcpPreferencesFx.Props) {
	const fileSystem = provided ?? (yield* FileSystem.FileSystem);
	const currentPath = join(root, "editor-mcp.port.json");
	const ngrokPath = join(root, "editor-mcp.ngrok.json");
	const writeSemaphore = yield* Semaphore.make(1);
	return {
		readPortFx: readElectronPreferenceFx({
			fileSystem,
			path: currentPath,
			fallback: DefaultEditorMcpPort,
			operation: "read the editor MCP port preference",
			parse: (stored) => {
				try {
					return EditorMcpPortSchema.safeParse(JSON.parse(stored)).data;
				} catch {
					return undefined;
				}
			},
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
					serialize: (value) => JSON.stringify(EditorMcpPortSchema.parse(value)),
				}),
			),
		readNgrokFx: readElectronPreferenceFx({
			fileSystem,
			path: ngrokPath,
			fallback: undefined as EditorMcpNgrokSettingsSchema.Type | undefined,
			operation: "read the editor MCP ngrok configuration",
			parse: (stored) => {
				try {
					return EditorMcpNgrokSettingsSchema.safeParse(JSON.parse(stored)).data;
				} catch {
					return undefined;
				}
			},
		}),
		writeNgrokFx: (configuration) =>
			writeSemaphore.withPermits(1)(
				writeElectronPreferenceFx({
					root,
					fileSystem,
					pendingPath: join(root, "editor-mcp.ngrok.pending"),
					currentPath: ngrokPath,
					value: configuration,
					operation: "persist the editor MCP ngrok configuration",
					serialize: (stored) =>
						JSON.stringify(EditorMcpNgrokSettingsSchema.parse(stored)),
				}).pipe(Effect.andThen(fileSystem.chmod(ngrokPath, 0o600))),
			),
	} satisfies EditorMcpPreferences;
});
