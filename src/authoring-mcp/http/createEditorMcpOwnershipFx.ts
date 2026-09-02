import { Effect, Exit, Semaphore } from "effect";
import { randomBytes } from "node:crypto";

import type { EditorMcpCommandResultSchema } from "~/authoring-mcp/schema/EditorMcpCommandResultSchema";
import type { EditorMcpConfigurationSchema } from "~/authoring-mcp/schema/EditorMcpConfigurationSchema";
import type { EditorMcpOverviewSchema } from "~/authoring-mcp/schema/EditorMcpOverviewSchema";
import type { EditorMcpRemoteStatusSchema } from "~/authoring-mcp/schema/EditorMcpRemoteStatusSchema";
import type { EditorMcpStatus } from "~/authoring-mcp/schema/EditorMcpStatusSchema";
import type { EditorProjectServiceOwnership } from "~/project-authoring/service/EditorProjectServiceOwnership";
import { createRemoteHandlerFx } from "../auth/createRemoteHandlerFx";
import type { McpStorage } from "../storage/McpStorage";
import type { McpTunnel, McpTunnelSession } from "../tunnel/McpTunnel";
import { checkPortAvailabilityFx } from "./checkPortAvailabilityFx";
import { checkRemoteEndpointFx } from "./checkRemoteEndpointFx";
import { createHttpListenerOwnershipFx } from "./createHttpListenerOwnershipFx";

export interface ServerOwnership {
	readonly readLocalStatusFn: () => EditorMcpStatus;
	readonly readOverviewFx: Effect.Effect<EditorMcpOverviewSchema.Type, unknown, never>;
	readonly publishOverviewFx: Effect.Effect<void, unknown, never>;
	readonly configureFx: (
		configuration: EditorMcpConfigurationSchema.Type,
	) => Effect.Effect<EditorMcpOverviewSchema.Type, unknown, never>;
	readonly startLocalFx: Effect.Effect<EditorMcpCommandResultSchema.Type, unknown, never>;
	readonly stopLocalFx: Effect.Effect<EditorMcpCommandResultSchema.Type, unknown, never>;
	readonly startRemoteFx: Effect.Effect<EditorMcpCommandResultSchema.Type, unknown, never>;
	readonly stopRemoteFx: Effect.Effect<EditorMcpCommandResultSchema.Type, unknown, never>;
	readonly resetRemoteAuthFx: Effect.Effect<EditorMcpCommandResultSchema.Type, unknown, never>;
	readonly readProjectContextFn: () => string | undefined;
	readonly setProjectContextFn: (
		projectId: string,
		requestVersionCheckoutFx?: (versionId: string) => Effect.Effect<void, unknown, never>,
	) => void;
	readonly clearProjectContextFn: (projectId: string) => void;
	readonly resetProjectContextFn: () => void;
	readonly closeFx: Effect.Effect<void, unknown, never>;
	readonly closeSyncFn: () => void;
}

export namespace createEditorMcpOwnershipFx {
	export interface Props {
		readonly checkPortFx?: typeof checkPortAvailabilityFx;
		readonly checkRemoteFx?: (origin: URL) => Effect.Effect<void, unknown, never>;
		readonly editor: EditorProjectServiceOwnership;
		readonly notifyOverviewChangedFn: (overview: EditorMcpOverviewSchema.Type) => void;
		readonly notifyProjectChangedFn: (projectId: string) => void;
		readonly storage: McpStorage;
		readonly runPromiseFn: <Value, Error>(
			effect: Effect.Effect<Value, Error, never>,
		) => Promise<Value>;
		readonly tunnel: McpTunnel;
	}
}

/** Owns one optional listener shared by open local MCP and OAuth-protected Remote MCP. */
export const createEditorMcpOwnershipFx = Effect.fn("createEditorMcpOwnershipFx")(function* ({
	checkPortFx = checkPortAvailabilityFx,
	checkRemoteFx = checkRemoteEndpointFx,
	editor,
	notifyOverviewChangedFn,
	notifyProjectChangedFn,
	storage,
	runPromiseFn,
	tunnel,
}: createEditorMcpOwnershipFx.Props) {
	let localEnabled = false;
	let localStatus: EditorMcpStatus =
		editor.type === "ready"
			? {
					type: "inactive",
				}
			: {
					type: "unavailable",
					message: editor.message,
				};
	let remoteStatus: EditorMcpRemoteStatusSchema.Type = {
		type: "inactive",
	};
	let tunnelSession: McpTunnelSession | undefined;
	let projectContext: string | undefined;
	let versionCheckoutRequestFx:
		| ((versionId: string) => Effect.Effect<void, unknown, never>)
		| undefined;
	const commandLock = yield* Semaphore.make(1);
	const httpListener = yield* createHttpListenerOwnershipFx({
		editor,
		notifyProjectChangedFn,
		storage,
		readProjectContextFn: () => projectContext,
		requestVersionCheckoutFx: (projectId, versionId) => {
			if (projectContext !== projectId || versionCheckoutRequestFx === undefined)
				return Effect.fail(
					new Error("The open editor renderer is unavailable for version checkout."),
				);
			return versionCheckoutRequestFx(versionId);
		},
		runPromiseFn,
	});

	const readOverviewFx = Effect.gen(function* () {
		const [port, ngrok, remotePassword] = yield* Effect.all([
			storage.readPortFx,
			storage.readNgrokFx,
			storage.ensureSecretFx,
		]);
		return {
			port,
			ngrokDomain: ngrok?.domain,
			remotePassword,
			local: localStatus,
			remote: remoteStatus,
		} satisfies EditorMcpOverviewSchema.Type;
	});
	const publishOverviewFx = readOverviewFx.pipe(
		Effect.tap((overview) => Effect.sync(() => notifyOverviewChangedFn(overview))),
		Effect.asVoid,
	);
	const configureFx = (configuration: EditorMcpConfigurationSchema.Type) =>
		commandLock.withPermits(1)(
			Effect.gen(function* () {
				if (configuration.type === "port") {
					if (
						localEnabled ||
						remoteStatus.type === "ready" ||
						remoteStatus.type === "starting"
					)
						return yield* Effect.fail(
							new Error("Stop Local and Remote MCP before changing the port."),
						);
					const availability = yield* checkPortFx(configuration.port);
					if (availability.type === "unavailable")
						return yield* Effect.fail(new Error(availability.message));
					yield* storage.writePortFx(configuration.port);
				} else {
					if (remoteStatus.type === "ready" || remoteStatus.type === "starting")
						return yield* Effect.fail(
							new Error("Stop Remote MCP before changing the ngrok configuration."),
						);
					yield* storage.writeNgrokFx({
						authtoken: configuration.authtoken,
						domain: configuration.domain,
					});
				}
				const overview = yield* readOverviewFx;
				yield* Effect.sync(() => notifyOverviewChangedFn(overview));
				return overview;
			}),
		);
	const closeServerFx = httpListener.closeFx;
	const ensureServerFx = httpListener.ensureStartedFx;
	const finishTunnelFx = (session: McpTunnelSession, cause?: unknown) =>
		commandLock.withPermits(1)(
			Effect.gen(function* () {
				if (tunnelSession !== session) return;
				tunnelSession = undefined;
				httpListener.setRemoteHandlerFn(undefined);
				yield* session.closeFx.pipe(Effect.ignore);
				remoteStatus = {
					type: "unavailable",
					message:
						cause === undefined
							? "The Remote MCP tunnel stopped unexpectedly."
							: `The Remote MCP tunnel stopped: ${cause instanceof Error ? cause.message : String(cause)}`,
				};
				if (!localEnabled) yield* closeServerFx.pipe(Effect.ignore);
				yield* publishOverviewFx;
			}),
		);
	const startLocalFx = commandLock.withPermits(1)(
		Effect.gen(function* () {
			if (localEnabled && localStatus.type === "ready")
				return {
					overview: yield* readOverviewFx,
				};
			const result = yield* Effect.exit(ensureServerFx);
			if (Exit.isFailure(result)) {
				localStatus = {
					type: "unavailable",
					message: `The local MCP server could not start: ${String(result.cause)}`,
				};
			} else {
				localEnabled = true;
				httpListener.setLocalEnabledFn(true);
				localStatus = {
					type: "ready",
					port: yield* storage.readPortFx,
				};
			}
			const overview = yield* readOverviewFx;
			yield* Effect.sync(() => notifyOverviewChangedFn(overview));
			return {
				overview,
			};
		}),
	);
	const stopLocalFx = commandLock.withPermits(1)(
		Effect.gen(function* () {
			localEnabled = false;
			httpListener.setLocalEnabledFn(false);
			localStatus =
				editor.type === "ready"
					? {
							type: "inactive",
						}
					: {
							type: "unavailable",
							message: editor.message,
						};
			if (remoteStatus.type !== "ready" && remoteStatus.type !== "starting")
				yield* closeServerFx.pipe(Effect.ignore);
			const overview = yield* readOverviewFx;
			yield* Effect.sync(() => notifyOverviewChangedFn(overview));
			return {
				overview,
			};
		}),
	);
	const stopRemoteUnlockedFx = Effect.gen(function* () {
		httpListener.setRemoteHandlerFn(undefined);
		const session = tunnelSession;
		tunnelSession = undefined;
		if (session !== undefined) yield* session.closeFx.pipe(Effect.ignore);
		remoteStatus = {
			type: "inactive",
		};
		if (!localEnabled) yield* closeServerFx.pipe(Effect.ignore);
	});
	const startRemoteFx = commandLock.withPermits(1)(
		Effect.gen(function* () {
			if (remoteStatus.type === "ready")
				return {
					overview: yield* readOverviewFx,
				};
			remoteStatus = {
				type: "starting",
			};
			yield* publishOverviewFx;
			let openedSession: McpTunnelSession | undefined;
			const provenance = randomBytes(32).toString("base64url");
			const started = yield* Effect.exit(
				Effect.gen(function* () {
					const ngrok = yield* storage.readNgrokFx;
					if (ngrok === undefined)
						return yield* Effect.fail(
							new Error(
								"Save an ngrok authtoken and domain in Tunnel settings first.",
							),
						);
					yield* storage.ensureSecretFx;
					yield* ensureServerFx;
					const port = yield* storage.readPortFx;
					openedSession = yield* tunnel.openFx({
						authtoken: ngrok.authtoken,
						domain: ngrok.domain,
						port,
						provenance,
					});
					const origin = openedSession.url;
					const mcpNodeHandlerFn = httpListener.readMcpHandlerFn();
					if (mcpNodeHandlerFn === undefined)
						return yield* Effect.fail(new Error("The MCP handler is unavailable."));
					const handler = yield* createRemoteHandlerFx({
						storage,
						mcpHandlerFn: mcpNodeHandlerFn,
						origin,
						runPromiseFn,
					});
					httpListener.setRemoteHandlerFn({
						handler,
						provenance,
					});
					yield* checkRemoteFx(origin);
					return {
						origin,
						session: openedSession,
					};
				}),
			);
			if (Exit.isFailure(started)) {
				httpListener.setRemoteHandlerFn(undefined);
				if (openedSession !== undefined) yield* openedSession.closeFx.pipe(Effect.ignore);
				if (!localEnabled) yield* closeServerFx.pipe(Effect.ignore);
				remoteStatus = {
					type: "unavailable",
					message: `Remote MCP could not start: ${String(started.cause)}`,
				};
			} else {
				tunnelSession = started.value.session;
				remoteStatus = {
					type: "ready",
					url: new URL("/remote/mcp", started.value.origin).href,
				};
				void runPromiseFn(started.value.session.closedFx)
					.then(
						() => runPromiseFn(finishTunnelFx(started.value.session)),
						(cause) => runPromiseFn(finishTunnelFx(started.value.session, cause)),
					)
					.catch((cause) => console.error("Remote MCP tunnel settlement failed.", cause));
			}
			const overview = yield* readOverviewFx;
			yield* Effect.sync(() => notifyOverviewChangedFn(overview));
			return {
				overview,
			};
		}),
	);
	const stopRemoteFx = commandLock.withPermits(1)(
		stopRemoteUnlockedFx.pipe(
			Effect.andThen(readOverviewFx),
			Effect.tap((overview) => Effect.sync(() => notifyOverviewChangedFn(overview))),
			Effect.map((overview) => ({
				overview,
			})),
		),
	);
	const resetRemoteAuthFx = commandLock.withPermits(1)(
		Effect.gen(function* () {
			yield* stopRemoteUnlockedFx;
			yield* storage.resetFx;
			const overview = yield* readOverviewFx;
			yield* Effect.sync(() => notifyOverviewChangedFn(overview));
			return {
				overview,
			};
		}),
	);
	const closeFx = commandLock.withPermits(1)(
		Effect.gen(function* () {
			httpListener.setRemoteHandlerFn(undefined);
			const session = tunnelSession;
			tunnelSession = undefined;
			if (session !== undefined) yield* session.closeFx.pipe(Effect.ignore);
			yield* closeServerFx.pipe(Effect.ignore);
		}),
	);
	return {
		readLocalStatusFn: () => localStatus,
		readOverviewFx,
		publishOverviewFx,
		configureFx,
		startLocalFx,
		stopLocalFx,
		startRemoteFx,
		stopRemoteFx,
		resetRemoteAuthFx,
		readProjectContextFn: () => projectContext,
		setProjectContextFn: (projectId, requestVersionCheckoutFx) => {
			projectContext = projectId;
			versionCheckoutRequestFx = requestVersionCheckoutFx;
		},
		clearProjectContextFn: (projectId) => {
			if (projectContext !== projectId) return;
			projectContext = undefined;
			versionCheckoutRequestFx = undefined;
		},
		resetProjectContextFn: () => {
			projectContext = undefined;
			versionCheckoutRequestFx = undefined;
		},
		closeFx,
		closeSyncFn: () => {
			httpListener.setRemoteHandlerFn(undefined);
			const session = tunnelSession;
			tunnelSession = undefined;
			if (session !== undefined)
				void runPromiseFn(session.closeFx).catch((cause) =>
					console.error("Remote MCP tunnel could not close.", cause),
				);
			httpListener.closeSyncFn();
		},
	} satisfies ServerOwnership;
});
