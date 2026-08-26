import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect } from "effect";

import {
	createEditorMcpOwnershipFx,
	type EditorMcpOwnership,
} from "../../../../../electron/main/editor-mcp/http/createEditorMcpOwnershipFx";
import { createFilesystemEditorMcpStorageFx } from "../../../../../electron/main/editor-mcp/storage/createFilesystemEditorMcpStorageFx";
import { createFilesystemEditorProjectRepositoryFx } from "../../../../../electron/main/editor-project/filesystem/fx/createFilesystemEditorProjectRepositoryFx";
import type { OwnedEditorProjectRepository } from "../../../../../electron/main/editor-project/EditorProjectServiceOwnership";

const cleanups: Array<() => Promise<void> | void> = [];

export const registerEditorMcpCleanup = (cleanup: () => Promise<void> | void) => {
	cleanups.push(cleanup);
};

export const cleanupEditorMcpHarnesses = async () => {
	for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
};

export const createEditorMcpProjectRepository = async (
	registerCleanup: (cleanup: () => Promise<void>) => void = registerEditorMcpCleanup,
): Promise<OwnedEditorProjectRepository> => {
	const root = await mkdtemp(join(tmpdir(), "arkini-editor-mcp-projects-"));
	registerCleanup(() =>
		rm(root, {
			force: true,
			recursive: true,
		}),
	);
	const repository = await Effect.runPromise(
		createFilesystemEditorProjectRepositoryFx({
			catalogPath: join(root, "projects.json"),
			projectsRoot: join(root, "projects"),
		}).pipe(Effect.provide(NodeServices.layer)),
	);
	registerCleanup(() => Effect.runPromise(repository.closeFx));
	return repository;
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

export const createTestEditorMcpStorage = async (
	port?: number,
	ngrok?: {
		readonly authtoken: string;
		readonly domain: string;
	},
) => {
	const directory = await mkdtemp(join(tmpdir(), "arkini-editor-mcp-storage-"));
	registerEditorMcpCleanup(() =>
		rm(directory, {
			force: true,
			recursive: true,
		}),
	);
	const storage = await Effect.runPromise(
		createFilesystemEditorMcpStorageFx({
			root: join(directory, "editor"),
			protectFx: (value) => Effect.succeed(Buffer.from(value)),
			unprotectFx: (value) => Effect.succeed(Buffer.from(value).toString()),
		}),
	);
	if (port !== undefined) await Effect.runPromise(storage.writePortFx(port));
	if (ngrok !== undefined) await Effect.runPromise(storage.writeNgrokFx(ngrok));
	return storage;
};

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
	readonly repository: OwnedEditorProjectRepository;
}

export const createEditorMcpHarness = async (
	runPromise: createEditorMcpOwnershipFx.Props["runPromise"] = Effect.runPromise,
	notifyProjectChanged: (projectId: string) => void = () => undefined,
): Promise<EditorMcpHarness> => {
	const repository = await createEditorMcpProjectRepository();
	const port = await reserveReleasedEditorMcpPort();
	const storage = await createTestEditorMcpStorage(port);
	const ownership = Effect.runSync(
		createEditorMcpOwnershipFx({
			editor: {
				type: "ready",
				repository,
			},
			notifyOverviewChanged: () => undefined,
			notifyProjectChanged,
			storage,
			runPromise,
			tunnel: {
				openFx: () =>
					Effect.fail(new Error("Remote MCP is unavailable in the local harness.")),
			},
		}),
	);
	registerEditorMcpCleanup(() => Effect.runPromise(ownership.closeFx));
	return {
		ownership,
		port,
		repository,
	};
};
