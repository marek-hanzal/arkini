import { EventEmitter } from "node:events";
import type { IpcMainInvokeEvent, WebContents } from "electron";
import { Effect } from "effect";
import { vi } from "vitest";

import { ElectronMainError } from "~electron/main/ElectronMainError";
import type { ServerOwnership } from "~/authoring-mcp/http/createEditorMcpOwnershipFx";
import type { TrustedRenderer } from "~electron/main/security/TrustedRenderer";

export const createEvent = () => {
	const sender = new EventEmitter() as WebContents;
	Object.assign(sender, {
		isDestroyed: vi.fn(() => false),
		postMessage: vi.fn(),
	});
	return {
		event: {
			sender,
		} as IpcMainInvokeEvent,
		sender,
	};
};

export const createTrustedRenderer = (trusted = true): TrustedRenderer => ({
	isTrustedUrlFn: () => trusted,
	isTrustedIpcSenderFn: () => trusted,
	assertTrustedIpcSenderFx: () =>
		trusted
			? Effect.void
			: Effect.fail(
					new ElectronMainError({
						operation: "authorize MCP context test renderer",
						cause: "untrusted",
					}),
				),
	registerWindowFx: () => Effect.void,
});

export const createOwnership = (localReady = false): ServerOwnership => {
	let projectContext: string | undefined;
	const overview = {
		port: 32_310,
		remotePassword: "arkini_mcp_fixture",
		local: localReady
			? {
					type: "ready" as const,
					port: 32_310,
				}
			: {
					type: "inactive" as const,
				},
		remote: {
			type: "inactive" as const,
		},
	};
	return {
		readLocalStatusFn: () => ({
			type: "inactive",
		}),
		readOverviewFx: Effect.succeed(overview),
		publishOverviewFx: Effect.void,
		configureFx: vi.fn((configuration) =>
			localReady && configuration.type === "port"
				? Effect.fail(new Error("Stop Local and Remote MCP before changing the port."))
				: Effect.succeed(overview),
		),
		startLocalFx: Effect.succeed({
			overview,
		}),
		stopLocalFx: Effect.succeed({
			overview,
		}),
		startRemoteFx: Effect.succeed({
			overview,
		}),
		stopRemoteFx: Effect.succeed({
			overview,
		}),
		resetRemoteAuthFx: Effect.succeed({
			overview,
		}),
		readProjectContextFn: () => projectContext,
		setProjectContextFn: vi.fn((projectId) => {
			projectContext = projectId;
		}),
		clearProjectContextFn: vi.fn((projectId) => {
			if (projectContext === projectId) projectContext = undefined;
		}),
		resetProjectContextFn: vi.fn(() => {
			projectContext = undefined;
		}),
		closeFx: Effect.void,
		closeSyncFn: vi.fn(),
	};
};
