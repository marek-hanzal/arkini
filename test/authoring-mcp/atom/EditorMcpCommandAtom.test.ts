import { scheduleTask } from "@effect/atom-react";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EditorMcpOverviewSchema } from "~electron/contract/editor/EditorMcpOverviewSchema";
import { EditorMcpCommandAtom } from "~/authoring-mcp/atom/EditorMcpCommandAtom";

const mcpState = vi.hoisted(
	(): {
		overview: EditorMcpOverviewSchema.Type;
	} => ({
		overview: {
			port: 32_310,
			ngrokDomain: "stable-example.ngrok-free.app",
			remotePassword: "arkini_mcp_generated",
			local: {
				type: "inactive" as const,
			},
			remote: {
				type: "ready" as const,
				url: "https://stable-example.ngrok-free.app/remote/mcp",
			},
		},
	}),
);

beforeEach(() => {
	vi.stubGlobal("window", {
		arkini: {
			editorMcp: {
				commandFn: async () => ({
					overview: mcpState.overview,
				}),
				configureFn: async () => mcpState.overview,
				readOverviewFn: async () => mcpState.overview,
			},
		},
	});
});

const registries: AtomRegistry.AtomRegistry[] = [];

const createRegistry = () => {
	const registry = AtomRegistry.make({
		defaultIdleTTL: 400,
		scheduleTask,
	});
	registries.push(registry);
	registry.mount(EditorMcpCommandAtom);
	return registry;
};

const waitForReady = async (registry: AtomRegistry.AtomRegistry) => {
	await vi.waitFor(() => expect(registry.get(EditorMcpCommandAtom).kind).toBe("ready"));
	return registry.get(EditorMcpCommandAtom);
};

afterEach(() => {
	for (const registry of registries.splice(0)) registry.dispose();
	vi.unstubAllGlobals();
});

describe("EditorMcpCommandAtom", () => {
	it("refreshes a remounted workspace from the canonical overview", async () => {
		const registry = createRegistry();
		registry.set(EditorMcpCommandAtom, {
			type: "read",
		});
		await waitForReady(registry);
		registry.set(EditorMcpCommandAtom, {
			type: "execute",
			command: "reset-remote-auth",
		});
		await vi.waitFor(() =>
			expect(registry.get(EditorMcpCommandAtom)).toMatchObject({
				kind: "ready",
				overview: {
					remotePassword: "arkini_mcp_generated",
				},
			}),
		);

		mcpState.overview = {
			...mcpState.overview,
			remote: {
				type: "unavailable",
				message: "The tunnel stopped.",
			},
		} satisfies EditorMcpOverviewSchema.Type;
		registry.set(EditorMcpCommandAtom, {
			type: "read",
		});

		expect(await waitForReady(registry)).toMatchObject({
			kind: "ready",
			overview: {
				remotePassword: "arkini_mcp_generated",
				remote: {
					type: "unavailable",
				},
			},
		});
	});
});
