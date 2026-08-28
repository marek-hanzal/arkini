import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import {
	localhostHostValidation,
	localhostOriginValidation,
	toNodeHandler,
} from "@modelcontextprotocol/node";
import { createMcpHandler, type McpHttpHandler } from "@modelcontextprotocol/server";
import { Effect } from "effect";

import type { EditorProjectServiceOwnership } from "../../editor-project/EditorProjectServiceOwnership";
import type { EditorMcpRemoteHandler } from "../auth/createEditorMcpRemoteHandlerFx";
import type { EditorMcpStorage } from "../storage/EditorMcpStorage";
import { EditorMcpTunnelProvenanceHeader } from "../tunnel/EditorMcpTunnelProvenanceHeader";
import { createEditorMcpServerFx } from "../tool/createEditorMcpServerFx";

type NodeMcpHandler = (request: IncomingMessage, response: ServerResponse) => void;

export interface EditorMcpHttpListenerOwnership {
	readonly ensureStartedFx: Effect.Effect<void, unknown>;
	readonly readMcpHandler: () => NodeMcpHandler | undefined;
	readonly setLocalEnabled: (enabled: boolean) => void;
	readonly setRemoteHandler: (
		remote:
			| {
					readonly handler: EditorMcpRemoteHandler;
					readonly provenance: string;
			  }
			| undefined,
	) => void;
	readonly closeFx: Effect.Effect<void, unknown>;
	readonly closeSync: () => void;
}

export namespace createEditorMcpHttpListenerOwnershipFx {
	export interface Props {
		readonly editor: EditorProjectServiceOwnership;
		readonly notifyProjectChanged: (projectId: string) => void;
		readonly storage: Pick<EditorMcpStorage, "readPortFx">;
		readonly readProjectContext: () => string | undefined;
		readonly requestVersionCheckoutFx: (
			projectId: string,
			versionId: string,
		) => Effect.Effect<void, unknown>;
		readonly runPromise: <Value, Error>(effect: Effect.Effect<Value, Error>) => Promise<Value>;
	}
}

const writeNotFound = (response: ServerResponse) => {
	response.writeHead(404, {
		"content-type": "text/plain; charset=utf-8",
	});
	response.end("Not found");
};

const writeBadRequest = (response: ServerResponse) => {
	response.writeHead(400, {
		"content-type": "text/plain; charset=utf-8",
	});
	response.end("Bad request");
};

/** Owns the one physical loopback listener shared by local and Remote MCP routing. */
export const createEditorMcpHttpListenerOwnershipFx = Effect.fn(
	"createEditorMcpHttpListenerOwnershipFx",
)(function* ({
	editor,
	notifyProjectChanged,
	storage,
	readProjectContext,
	requestVersionCheckoutFx,
	runPromise,
}: createEditorMcpHttpListenerOwnershipFx.Props) {
	let localEnabled = false;
	let server: Server | undefined;
	let mcpHandler: McpHttpHandler | undefined;
	let nodeHandler: NodeMcpHandler | undefined;
	let remote:
		| {
				readonly handler: EditorMcpRemoteHandler;
				readonly provenance: string;
		  }
		| undefined;
	const validateLocalHost = localhostHostValidation();
	const validateLocalOrigin = localhostOriginValidation();
	const closeFx = Effect.tryPromise({
		try: async () => {
			const currentServer = server;
			const currentHandler = mcpHandler;
			server = undefined;
			mcpHandler = undefined;
			nodeHandler = undefined;
			remote = undefined;
			localEnabled = false;
			await Promise.all([
				currentServer === undefined
					? Promise.resolve()
					: new Promise<void>((resolve, reject) => {
							currentServer.close((error) =>
								error === undefined ? resolve() : reject(error),
							);
							currentServer.closeAllConnections();
						}),
				currentHandler?.close() ?? Promise.resolve(),
			]);
		},
		catch: (cause) => cause,
	});
	const ensureStartedFx = Effect.gen(function* () {
		if (server !== undefined && nodeHandler !== undefined) return;
		if (editor.type === "unavailable") return yield* Effect.fail(new Error(editor.message));
		const factory = yield* createEditorMcpServerFx({
			notifyProjectChanged,
			readProjectContext,
			repository: editor.repository,
			requestVersionCheckoutFx,
			runPromise,
		});
		const handler = createMcpHandler(factory.create);
		const boundNodeHandler = toNodeHandler(handler, {
			onerror: (error) => console.error("Arkini editor MCP request failed.", error),
		});
		const listener = createServer((request, response) => {
			let pathname: string;
			try {
				pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
			} catch {
				writeBadRequest(response);
				return;
			}
			const tunnelProvenance = request.headers[EditorMcpTunnelProvenanceHeader];
			if (tunnelProvenance !== undefined) {
				if (remote !== undefined && tunnelProvenance === remote.provenance)
					remote.handler.handle(request, response);
				else writeNotFound(response);
				return;
			}
			if (pathname === "/editor/mcp") {
				if (!localEnabled) return writeNotFound(response);
				if (
					!validateLocalHost(request, response) ||
					!validateLocalOrigin(request, response)
				)
					return;
				void boundNodeHandler(request, response);
				return;
			}
			writeNotFound(response);
		});
		const port = yield* storage.readPortFx;
		yield* Effect.callback<void, Error>((resume) => {
			const onError = (cause: Error) => resume(Effect.fail(cause));
			listener.once("error", onError);
			listener.listen(port, "127.0.0.1", () => {
				listener.removeListener("error", onError);
				resume(Effect.void);
			});
			return Effect.sync(() => {
				try {
					listener.close();
				} catch {
					// A listener that never bound has nothing to close.
				}
			});
		}).pipe(
			Effect.tapError(() =>
				Effect.promise(() =>
					handler
						.close()
						.catch((error) =>
							console.error("Arkini editor MCP handler could not close.", error),
						),
				),
			),
		);
		server = listener;
		mcpHandler = handler;
		nodeHandler = boundNodeHandler;
	});
	return {
		ensureStartedFx,
		readMcpHandler: () => nodeHandler,
		setLocalEnabled: (enabled) => {
			localEnabled = enabled;
		},
		setRemoteHandler: (candidate) => {
			remote = candidate;
		},
		closeFx,
		closeSync: () => {
			remote = undefined;
			localEnabled = false;
			try {
				server?.close();
				server?.closeAllConnections();
			} catch {
				// Process shutdown may race a failed listener bind.
			}
			server = undefined;
			void mcpHandler
				?.close()
				.catch((error) =>
					console.error("Arkini editor MCP handler could not close.", error),
				);
			mcpHandler = undefined;
			nodeHandler = undefined;
		},
	} satisfies EditorMcpHttpListenerOwnership;
});
