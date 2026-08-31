import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import {
	localhostHostValidation,
	localhostOriginValidation,
	toNodeHandler,
} from "@modelcontextprotocol/node";
import { createMcpHandler, type McpHttpHandler } from "@modelcontextprotocol/server";
import { Effect } from "effect";

import type { EditorProjectServiceOwnership } from "~electron/main/editor-project/EditorProjectServiceOwnership";
import type { RemoteHandler } from "../auth/createRemoteHandlerFx";
import type { McpStorage } from "../storage/McpStorage";
import { TunnelProvenanceHeader } from "../tunnel/TunnelProvenanceHeader";
import { createServerFx } from "../tool/createServerFx";

type NodeMcpHandler = (request: IncomingMessage, response: ServerResponse) => void;

interface HttpListenerOwnership {
	readonly ensureStartedFx: Effect.Effect<void, unknown, never>;
	readonly readMcpHandlerFn: () => NodeMcpHandler | undefined;
	readonly setLocalEnabledFn: (enabled: boolean) => void;
	readonly setRemoteHandlerFn: (
		remote:
			| {
					readonly handler: RemoteHandler;
					readonly provenance: string;
			  }
			| undefined,
	) => void;
	readonly closeFx: Effect.Effect<void, unknown, never>;
	readonly closeSyncFn: () => void;
}

export namespace createHttpListenerOwnershipFx {
	export interface Props {
		readonly editor: EditorProjectServiceOwnership;
		readonly notifyProjectChangedFn: (projectId: string) => void;
		readonly storage: Pick<McpStorage, "readPortFx">;
		readonly readProjectContextFn: () => string | undefined;
		readonly requestVersionCheckoutFx: (
			projectId: string,
			versionId: string,
		) => Effect.Effect<void, unknown, never>;
		readonly runPromiseFn: <Value, Error>(
			effect: Effect.Effect<Value, Error, never>,
		) => Promise<Value>;
	}
}

const writeNotFoundFn = (response: ServerResponse) => {
	response.writeHead(404, {
		"content-type": "text/plain; charset=utf-8",
	});
	response.end("Not found");
};

const writeBadRequestFn = (response: ServerResponse) => {
	response.writeHead(400, {
		"content-type": "text/plain; charset=utf-8",
	});
	response.end("Bad request");
};

/** Owns the one physical loopback listener shared by local and Remote MCP routing. */
export const createHttpListenerOwnershipFx = Effect.fn("createHttpListenerOwnershipFx")(function* ({
	editor,
	notifyProjectChangedFn,
	storage,
	readProjectContextFn,
	requestVersionCheckoutFx,
	runPromiseFn,
}: createHttpListenerOwnershipFx.Props) {
	let localEnabled = false;
	let server: Server | undefined;
	let mcpHandler: McpHttpHandler | undefined;
	let nodeHandlerFn: NodeMcpHandler | undefined;
	let remote:
		| {
				readonly handler: RemoteHandler;
				readonly provenance: string;
		  }
		| undefined;
	const validateLocalHostFn = localhostHostValidation();
	const validateLocalOriginFn = localhostOriginValidation();
	const closeFx = Effect.tryPromise({
		try: async () => {
			const currentServer = server;
			const currentHandler = mcpHandler;
			server = undefined;
			mcpHandler = undefined;
			nodeHandlerFn = undefined;
			remote = undefined;
			localEnabled = false;
			await Promise.all([
				currentServer === undefined
					? Promise.resolve()
					: new Promise<void>((resolveFn, rejectFn) => {
							currentServer.close((error) =>
								error === undefined ? resolveFn() : rejectFn(error),
							);
							currentServer.closeAllConnections();
						}),
				currentHandler?.close() ?? Promise.resolve(),
			]);
		},
		catch: (cause) => cause,
	});
	const ensureStartedFx = Effect.gen(function* () {
		if (server !== undefined && nodeHandlerFn !== undefined) return;
		if (editor.type === "unavailable") return yield* Effect.fail(new Error(editor.message));
		const factory = yield* createServerFx({
			notifyProjectChangedFn,
			readProjectContextFn,
			repository: editor.repository,
			requestVersionCheckoutFx,
			runPromiseFn,
		});
		const handler = createMcpHandler(factory.create);
		const boundNodeHandlerFn = toNodeHandler(handler, {
			onerror: (error) => console.error("Arkini editor MCP request failed.", error),
		});
		const listener = createServer((request, response) => {
			let pathname: string;
			try {
				pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
			} catch {
				writeBadRequestFn(response);
				return;
			}
			const tunnelProvenance = request.headers[TunnelProvenanceHeader];
			if (tunnelProvenance !== undefined) {
				if (remote !== undefined && tunnelProvenance === remote.provenance)
					remote.handler.handleFn(request, response);
				else writeNotFoundFn(response);
				return;
			}
			if (pathname === "/editor/mcp") {
				if (!localEnabled) return writeNotFoundFn(response);
				if (
					!validateLocalHostFn(request, response) ||
					!validateLocalOriginFn(request, response)
				)
					return;
				void boundNodeHandlerFn(request, response);
				return;
			}
			writeNotFoundFn(response);
		});
		const port = yield* storage.readPortFx;
		yield* Effect.callback<void, Error>((resumeFn) => {
			const onErrorFn = (cause: Error) => resumeFn(Effect.fail(cause));
			listener.once("error", onErrorFn);
			listener.listen(port, "127.0.0.1", () => {
				listener.removeListener("error", onErrorFn);
				resumeFn(Effect.void);
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
		nodeHandlerFn = boundNodeHandlerFn;
	});
	return {
		ensureStartedFx,
		readMcpHandlerFn: () => nodeHandlerFn,
		setLocalEnabledFn: (enabled) => {
			localEnabled = enabled;
		},
		setRemoteHandlerFn: (candidate) => {
			remote = candidate;
		},
		closeFx,
		closeSyncFn: () => {
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
			nodeHandlerFn = undefined;
		},
	} satisfies HttpListenerOwnership;
});
