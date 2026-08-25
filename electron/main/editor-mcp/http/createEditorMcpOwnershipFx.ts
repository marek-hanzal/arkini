import { Effect, Exit, Semaphore } from "effect";
import { randomBytes } from "node:crypto";

import type { EditorMcpCommandResultSchema } from "../../../contract/editor/EditorMcpCommandResultSchema";
import type { EditorMcpConfigurationSchema } from "../../../contract/editor/EditorMcpConfigurationSchema";
import type { EditorMcpOverviewSchema } from "../../../contract/editor/EditorMcpOverviewSchema";
import type { EditorMcpRemoteStatusSchema } from "../../../contract/editor/EditorMcpRemoteStatusSchema";
import type { EditorMcpStatus } from "../../../contract/editor/EditorMcpStatusSchema";
import type { EditorProjectServiceOwnership } from "../../editor-project/EditorProjectServiceOwnership";
import type { EditorMcpAuthOwnership } from "../auth/EditorMcpAuthOwnership";
import { createEditorMcpRemoteHandlerFx } from "../auth/createEditorMcpRemoteHandlerFx";
import type { EditorMcpPreferences } from "../preference/EditorMcpPreferences";
import type { EditorMcpTunnel, EditorMcpTunnelSession } from "../tunnel/EditorMcpTunnel";
import { checkEditorMcpPortAvailabilityFx } from "./checkEditorMcpPortAvailabilityFx";
import { checkEditorMcpRemoteEndpointFx } from "./checkEditorMcpRemoteEndpointFx";
import { createEditorMcpHttpListenerOwnershipFx } from "./createEditorMcpHttpListenerOwnershipFx";

export interface EditorMcpOwnership {
	readonly readLocalStatus: () => EditorMcpStatus;
	readonly readOverviewFx: Effect.Effect<EditorMcpOverviewSchema.Type, unknown>;
	readonly publishOverviewFx: Effect.Effect<void, unknown>;
	readonly configureFx: (
		configuration: EditorMcpConfigurationSchema.Type,
	) => Effect.Effect<EditorMcpOverviewSchema.Type, unknown>;
	readonly startLocalFx: Effect.Effect<EditorMcpCommandResultSchema.Type, unknown>;
	readonly stopLocalFx: Effect.Effect<EditorMcpCommandResultSchema.Type, unknown>;
	readonly startRemoteFx: Effect.Effect<EditorMcpCommandResultSchema.Type, unknown>;
	readonly stopRemoteFx: Effect.Effect<EditorMcpCommandResultSchema.Type, unknown>;
	readonly resetRemoteAuthFx: Effect.Effect<EditorMcpCommandResultSchema.Type, unknown>;
	readonly readProjectContext: () => string | undefined;
	readonly setProjectContext: (
		projectId: string,
		requestVersionCheckoutFx?: (versionId: string) => Effect.Effect<void, unknown>,
	) => void;
	readonly clearProjectContext: (projectId: string) => void;
	readonly resetProjectContext: () => void;
	readonly closeFx: Effect.Effect<void, unknown>;
	readonly closeSync: () => void;
}

export namespace createEditorMcpOwnershipFx {
	export interface Props {
		readonly auth: EditorMcpAuthOwnership;
		readonly checkPortFx?: typeof checkEditorMcpPortAvailabilityFx;
		readonly checkRemoteFx?: (origin: URL) => Effect.Effect<void, unknown>;
		readonly editor: EditorProjectServiceOwnership;
		readonly notifyOverviewChanged: (overview: EditorMcpOverviewSchema.Type) => void;
		readonly notifyProjectChanged: (projectId: string) => void;
		readonly preferences: EditorMcpPreferences;
		readonly runPromise: <Value, Error>(effect: Effect.Effect<Value, Error>) => Promise<Value>;
		readonly tunnel: EditorMcpTunnel;
	}
}

/** Owns one optional listener shared by open local MCP and OAuth-protected Remote MCP. */
export const createEditorMcpOwnershipFx = Effect.fn("createEditorMcpOwnershipFx")(function* ({
	auth,
	checkPortFx = checkEditorMcpPortAvailabilityFx,
	checkRemoteFx = checkEditorMcpRemoteEndpointFx,
	editor,
	notifyOverviewChanged,
	notifyProjectChanged,
	preferences,
	runPromise,
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
	let tunnelSession: EditorMcpTunnelSession | undefined;
	let projectContext: string | undefined;
	let versionCheckoutRequestFx: ((versionId: string) => Effect.Effect<void, unknown>) | undefined;
	const commandLock = yield* Semaphore.make(1);
	const httpListener = yield* createEditorMcpHttpListenerOwnershipFx({
		editor,
		notifyProjectChanged,
		preferences,
		readProjectContext: () => projectContext,
		requestVersionCheckoutFx: (projectId, versionId) => {
			if (projectContext !== projectId || versionCheckoutRequestFx === undefined)
				return Effect.fail(
					new Error("The open editor renderer is unavailable for version checkout."),
				);
			return versionCheckoutRequestFx(versionId);
		},
		runPromise,
	});

	const readOverviewFx = Effect.gen(function* () {
		const [port, authtoken, domain, authConfigured] = yield* Effect.all([
			preferences.readPortFx,
			preferences.readNgrokAuthtokenFx,
			preferences.readNgrokDomainFx,
			auth.readConfiguredFx.pipe(Effect.catch(() => Effect.succeed(false))),
		]);
		return {
			port,
			ngrokConfigured: authtoken !== undefined,
			...(domain === undefined
				? {}
				: {
						ngrokDomain: domain,
					}),
			authConfigured,
			local: localStatus,
			remote: remoteStatus,
		} satisfies EditorMcpOverviewSchema.Type;
	});
	const publishOverviewFx = readOverviewFx.pipe(
		Effect.tap((overview) => Effect.sync(() => notifyOverviewChanged(overview))),
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
					yield* preferences.writePortFx(configuration.port);
				} else {
					yield* preferences.writeNgrokAuthtokenFx(configuration.authtoken);
				}
				const overview = yield* readOverviewFx;
				yield* Effect.sync(() => notifyOverviewChanged(overview));
				return overview;
			}),
		);
	const closeServerFx = httpListener.closeFx;
	const ensureServerFx = httpListener.ensureStartedFx;
	const finishTunnelFx = (session: EditorMcpTunnelSession, cause?: unknown) =>
		commandLock.withPermits(1)(
			Effect.gen(function* () {
				if (tunnelSession !== session) return;
				tunnelSession = undefined;
				httpListener.setRemoteHandler(undefined);
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
				httpListener.setLocalEnabled(true);
				localStatus = {
					type: "ready",
					port: yield* preferences.readPortFx,
				};
			}
			const overview = yield* readOverviewFx;
			yield* Effect.sync(() => notifyOverviewChanged(overview));
			return {
				overview,
			};
		}),
	);
	const stopLocalFx = commandLock.withPermits(1)(
		Effect.gen(function* () {
			localEnabled = false;
			httpListener.setLocalEnabled(false);
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
			yield* Effect.sync(() => notifyOverviewChanged(overview));
			return {
				overview,
			};
		}),
	);
	const stopRemoteUnlockedFx = Effect.gen(function* () {
		httpListener.setRemoteHandler(undefined);
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
			let openedSession: EditorMcpTunnelSession | undefined;
			let generatedSecret: string | undefined;
			const provenance = randomBytes(32).toString("base64url");
			const started = yield* Effect.exit(
				Effect.gen(function* () {
					const authtoken = yield* preferences.readNgrokAuthtokenFx;
					if (authtoken === undefined)
						return yield* Effect.fail(
							new Error("Save an ngrok authtoken in Tunnel settings first."),
						);
					generatedSecret = yield* auth.ensureSecretFx;
					yield* ensureServerFx;
					const port = yield* preferences.readPortFx;
					const configuredDomain = yield* preferences.readNgrokDomainFx;
					openedSession = yield* tunnel.openFx({
						authtoken,
						...(configuredDomain === undefined
							? {}
							: {
									domain: configuredDomain,
								}),
						port,
						provenance,
					});
					const origin = openedSession.url;
					if (configuredDomain !== undefined && origin.hostname !== configuredDomain)
						return yield* Effect.fail(
							new Error(
								`ngrok published ${origin.hostname} instead of the configured ${configuredDomain}. Reset Remote auth to discover the new domain.`,
							),
						);
					if (configuredDomain === undefined)
						yield* preferences.writeNgrokDomainFx(origin.hostname);
					const mcpNodeHandler = httpListener.readMcpHandler();
					if (mcpNodeHandler === undefined)
						return yield* Effect.fail(new Error("The MCP handler is unavailable."));
					const handler = yield* createEditorMcpRemoteHandlerFx({
						auth,
						mcpHandler: mcpNodeHandler,
						origin,
						runPromise,
					});
					httpListener.setRemoteHandler({
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
				httpListener.setRemoteHandler(undefined);
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
				void runPromise(started.value.session.joinFx)
					.then(
						() => runPromise(finishTunnelFx(started.value.session)),
						(cause) => runPromise(finishTunnelFx(started.value.session, cause)),
					)
					.catch((cause) => console.error("Remote MCP tunnel settlement failed.", cause));
			}
			const overview = yield* readOverviewFx;
			yield* Effect.sync(() => notifyOverviewChanged(overview));
			return {
				overview,
				...(generatedSecret === undefined
					? {}
					: {
							secret: generatedSecret,
						}),
			};
		}),
	);
	const stopRemoteFx = commandLock.withPermits(1)(
		stopRemoteUnlockedFx.pipe(
			Effect.andThen(readOverviewFx),
			Effect.tap((overview) => Effect.sync(() => notifyOverviewChanged(overview))),
			Effect.map((overview) => ({
				overview,
			})),
		),
	);
	const resetRemoteAuthFx = commandLock.withPermits(1)(
		Effect.gen(function* () {
			yield* stopRemoteUnlockedFx;
			const secret = yield* auth.resetFx;
			yield* preferences.clearNgrokDomainFx;
			const overview = yield* readOverviewFx;
			yield* Effect.sync(() => notifyOverviewChanged(overview));
			return {
				overview,
				secret,
			};
		}),
	);
	const closeFx = commandLock.withPermits(1)(
		Effect.gen(function* () {
			httpListener.setRemoteHandler(undefined);
			const session = tunnelSession;
			tunnelSession = undefined;
			if (session !== undefined) yield* session.closeFx.pipe(Effect.ignore);
			yield* closeServerFx.pipe(Effect.ignore);
			yield* auth.closeFx.pipe(Effect.ignore);
		}),
	);
	return {
		readLocalStatus: () => localStatus,
		readOverviewFx,
		publishOverviewFx,
		configureFx,
		startLocalFx,
		stopLocalFx,
		startRemoteFx,
		stopRemoteFx,
		resetRemoteAuthFx,
		readProjectContext: () => projectContext,
		setProjectContext: (projectId, requestVersionCheckout) => {
			projectContext = projectId;
			versionCheckoutRequestFx = requestVersionCheckout;
		},
		clearProjectContext: (projectId) => {
			if (projectContext !== projectId) return;
			projectContext = undefined;
			versionCheckoutRequestFx = undefined;
		},
		resetProjectContext: () => {
			projectContext = undefined;
			versionCheckoutRequestFx = undefined;
		},
		closeFx,
		closeSync: () => {
			httpListener.setRemoteHandler(undefined);
			const session = tunnelSession;
			tunnelSession = undefined;
			if (session !== undefined)
				void runPromise(session.closeFx).catch((cause) =>
					console.error("Remote MCP tunnel could not close.", cause),
				);
			httpListener.closeSync();
			void runPromise(auth.closeFx).catch((cause) =>
				console.error("Remote MCP auth database could not close.", cause),
			);
		},
	} satisfies EditorMcpOwnership;
});
