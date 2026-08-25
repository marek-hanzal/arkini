import { FileSystem } from "effect";
import { Effect, Semaphore } from "effect";
import { join } from "node:path";

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

/** Owns global MCP transport preferences independently from editor database readiness. */
export const createFilesystemEditorMcpPreferencesFx = Effect.fn(
	"createFilesystemEditorMcpPreferencesFx",
)(function* ({ root, fileSystem: provided }: createFilesystemEditorMcpPreferencesFx.Props) {
	const fileSystem = provided ?? (yield* FileSystem.FileSystem);
	const currentPath = join(root, "editor-mcp.port");
	const ngrokAuthtokenPath = join(root, "editor-mcp.ngrok-authtoken");
	const ngrokDomainPath = join(root, "editor-mcp.ngrok-domain");
	const writeSemaphore = yield* Semaphore.make(1);
	const readOptionalPreferenceFx = (path: string, operation: string) =>
		readElectronPreferenceFx({
			fileSystem,
			path,
			fallback: undefined as string | undefined,
			operation,
			parse: (stored) => stored.trim() || undefined,
		});
	const writeStringPreferenceFx = (
		path: string,
		pendingPath: string,
		value: string,
		operation: string,
	) =>
		writeElectronPreferenceFx({
			root,
			fileSystem,
			pendingPath,
			currentPath: path,
			value,
			operation,
			serialize: (stored) => stored.trim(),
		});
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
		readNgrokAuthtokenFx: readOptionalPreferenceFx(
			ngrokAuthtokenPath,
			"read the editor MCP ngrok authtoken",
		),
		writeNgrokAuthtokenFx: (authtoken) =>
			writeSemaphore.withPermits(1)(
				writeStringPreferenceFx(
					ngrokAuthtokenPath,
					join(root, "editor-mcp.ngrok-authtoken.pending"),
					authtoken,
					"persist the editor MCP ngrok authtoken",
				).pipe(Effect.andThen(fileSystem.chmod(ngrokAuthtokenPath, 0o600))),
			),
		readNgrokDomainFx: readOptionalPreferenceFx(
			ngrokDomainPath,
			"read the editor MCP ngrok domain",
		),
		writeNgrokDomainFx: (domain) =>
			writeSemaphore.withPermits(1)(
				writeStringPreferenceFx(
					ngrokDomainPath,
					join(root, "editor-mcp.ngrok-domain.pending"),
					domain,
					"persist the editor MCP ngrok domain",
				),
			),
		clearNgrokDomainFx: writeSemaphore.withPermits(1)(
			fileSystem.remove(ngrokDomainPath, {
				force: true,
			}),
		),
	} satisfies EditorMcpPreferences;
});
