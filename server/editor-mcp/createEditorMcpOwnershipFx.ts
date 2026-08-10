import { createServer, type Server } from "node:http";
import {
	localhostHostValidation,
	localhostOriginValidation,
	toNodeHandler,
} from "@modelcontextprotocol/node";
import { createMcpHandler, type McpHttpHandler } from "@modelcontextprotocol/server";
import { Effect, Semaphore } from "effect";

import type {
	EditorMcpPortSchema,
	EditorMcpStatus,
} from "../../electron/contract/editor/EditorMcpPortSchema";
import type { EditorProjectServiceOwnership } from "../editor/EditorProjectServiceOwnership";
import { createEditorMcpServer } from "./createEditorMcpServer";

export interface EditorMcpOwnership {
	readonly readStatus: () => EditorMcpStatus;
	readonly readProjectContext: () => string | undefined;
	readonly setProjectContext: (projectId: string) => void;
	readonly clearProjectContext: (projectId: string) => void;
	readonly resetProjectContext: () => void;
	readonly activateFx: Effect.Effect<EditorMcpStatus>;
	readonly closeFx: Effect.Effect<void, unknown>;
	readonly closeSync: () => void;
}

export namespace createEditorMcpOwnershipFx {
	export interface Props {
		readonly editor: EditorProjectServiceOwnership;
		readonly readPortFx: Effect.Effect<EditorMcpPortSchema.Type, unknown>;
	}
}

/** Owns one lazy loopback MCP listener for the process lifetime after first editor entry. */
export const createEditorMcpOwnershipFx = Effect.fn("createEditorMcpOwnershipFx")(function* ({
	editor,
	readPortFx,
}: createEditorMcpOwnershipFx.Props) {
	let status: EditorMcpStatus =
		editor.type === "ready"
			? {
					type: "inactive",
				}
			: {
					type: "unavailable",
					message: editor.message,
				};
	let httpServer: Server | undefined;
	let mcpHandler: McpHttpHandler | undefined;
	let projectContext: string | undefined;
	const activationLock = yield* Semaphore.make(1);

	const activateFx = activationLock.withPermits(1)(
		Effect.gen(function* () {
			if (status.type !== "inactive" || editor.type === "unavailable") return status;
			const port = yield* readPortFx;
			const handler = createMcpHandler(() =>
				createEditorMcpServer(editor.repository, () => projectContext),
			);
			const nodeHandler = toNodeHandler(handler, {
				onerror: (error) => console.error("Arkini editor MCP request failed.", error),
			});
			const validateHost = localhostHostValidation();
			const validateOrigin = localhostOriginValidation();
			const server = createServer((request, response) => {
				const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
				if (pathname !== "/editor/mcp") {
					response.writeHead(404, {
						"content-type": "text/plain; charset=utf-8",
					});
					response.end("Not found");
					return;
				}
				if (!validateHost(request, response) || !validateOrigin(request, response)) return;
				void nodeHandler(request, response);
			});
			httpServer = server;
			mcpHandler = handler;
			yield* Effect.callback<void, Error>((resume) => {
				const onError = (cause: Error) => resume(Effect.fail(cause));
				server.once("error", onError);
				server.listen(port, "127.0.0.1", () => {
					server.removeListener("error", onError);
					resume(Effect.void);
				});
				return Effect.sync(() => {
					try {
						server.close();
					} catch {
						// A listener that never bound has nothing to close.
					}
				});
			});
			status = {
				type: "ready",
				port,
			};
			return status;
		}).pipe(
			Effect.catch((cause) =>
				Effect.sync(() => {
					try {
						httpServer?.close();
					} catch {
						// A failed bind has no open listener.
					}
					httpServer = undefined;
					void mcpHandler
						?.close()
						.catch((error) =>
							console.error("Arkini editor MCP handler could not close.", error),
						);
					mcpHandler = undefined;
					status = {
						type: "unavailable",
						message: `The editor MCP server could not start: ${cause instanceof Error ? cause.message : String(cause)}`,
					};
					return status;
				}),
			),
		),
	);

	const closeFx = Effect.tryPromise({
		try: async () => {
			const server = httpServer;
			const handler = mcpHandler;
			httpServer = undefined;
			mcpHandler = undefined;
			await Promise.all([
				server === undefined
					? Promise.resolve()
					: new Promise<void>((resolve, reject) =>
							server.close((error) =>
								error === undefined ? resolve() : reject(error),
							),
						),
				handler?.close() ?? Promise.resolve(),
			]);
		},
		catch: (cause) => cause,
	});
	return {
		readStatus: () => status,
		readProjectContext: () => projectContext,
		setProjectContext: (projectId) => {
			projectContext = projectId;
		},
		clearProjectContext: (projectId) => {
			if (projectContext === projectId) projectContext = undefined;
		},
		resetProjectContext: () => {
			projectContext = undefined;
		},
		activateFx,
		closeFx,
		closeSync: () => {
			try {
				httpServer?.close();
			} catch {
				// Process shutdown may race a failed activation.
			}
			httpServer = undefined;
			void mcpHandler
				?.close()
				.catch((error) =>
					console.error("Arkini editor MCP handler could not close.", error),
				);
			mcpHandler = undefined;
		},
	} satisfies EditorMcpOwnership;
});
