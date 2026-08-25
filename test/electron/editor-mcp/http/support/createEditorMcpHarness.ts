import { createServer } from "node:http";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { Effect } from "effect";

import {
	createEditorMcpOwnershipFx,
	type EditorMcpOwnership,
} from "../../../../../electron/main/editor-mcp/http/createEditorMcpOwnershipFx";
import {
	createSqliteEditorProjectRepositoryFx,
	type SqliteEditorProjectRepository,
} from "../../../../../electron/main/editor-project/sqlite/fx/createSqliteEditorProjectRepositoryFx";

const cleanups: Array<() => Promise<void> | void> = [];

export const registerEditorMcpCleanup = (cleanup: () => Promise<void> | void) => {
	cleanups.push(cleanup);
};

export const cleanupEditorMcpHarnesses = async () => {
	for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
};

export const reserveReleasedEditorMcpPort = () =>
	new Promise<number>((resolve, reject) => {
		const server = createServer();
		server.once("error", reject);
		server.listen(0, "127.0.0.1", () => {
			const address = server.address();
			if (address === null || typeof address === "string") {
				reject(new Error("Expected an ephemeral TCP port."));
				return;
			}
			server.close((error) => (error === undefined ? resolve(address.port) : reject(error)));
		});
	});

export const connectEditorMcpClient = async (port: number, mode: "auto" | "legacy" = "auto") => {
	const client = new Client(
		{
			name: `arkini-editor-${mode}-test`,
			version: "1.0.0",
		},
		{
			versionNegotiation: {
				mode,
			},
		},
	);
	registerEditorMcpCleanup(() => client.close());
	await client.connect(
		new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/editor/mcp`)),
	);
	return client;
};

export interface EditorMcpHarness {
	readonly ownership: EditorMcpOwnership;
	readonly port: number;
	readonly repository: SqliteEditorProjectRepository;
}

export const createEditorMcpHarness = async (
	runPromise: createEditorMcpOwnershipFx.Props["runPromise"] = Effect.runPromise,
	notifyProjectChanged: (projectId: string) => void = () => undefined,
): Promise<EditorMcpHarness> => {
	const repository = await Effect.runPromise(
		createSqliteEditorProjectRepositoryFx({
			databasePath: ":memory:",
		}),
	);
	registerEditorMcpCleanup(() => Effect.runPromise(repository.closeFx));
	const port = await reserveReleasedEditorMcpPort();
	const ownership = Effect.runSync(
		createEditorMcpOwnershipFx({
			editor: {
				type: "ready",
				repository,
			},
			notifyProjectChanged,
			readPortFx: Effect.succeed(port),
			runPromise,
		}),
	);
	registerEditorMcpCleanup(() => Effect.runPromise(ownership.closeFx));
	return {
		ownership,
		port,
		repository,
	};
};
