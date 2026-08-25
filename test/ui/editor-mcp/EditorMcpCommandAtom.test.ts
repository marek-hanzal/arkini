import { scheduleTask } from "@effect/atom-react";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { EditorMcpOverviewSchema } from "../../../electron/contract/editor/EditorMcpOverviewSchema";
import { EditorMcpCommandAtom } from "~/ui/editor-mcp/EditorMcpCommandAtom";

const bridge = vi.hoisted(
	(): {
		overview: EditorMcpOverviewSchema.Type;
	} => ({
		overview: {
			port: 32_310,
			ngrokConfigured: true,
			ngrokDomain: "stable-example.ngrok-free.app",
			authConfigured: true,
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

vi.mock("~/bridge/editor-mcp/readEditorMcpOverviewFx", async () => {
	const { Effect } = await import("effect");
	return {
		readEditorMcpOverviewFx: Effect.sync(() => bridge.overview),
	};
});

vi.mock("~/bridge/editor-mcp/configureEditorMcpFx", async () => {
	const { Effect } = await import("effect");
	return {
		configureEditorMcpFx: () => Effect.sync(() => bridge.overview),
	};
});

vi.mock("~/bridge/editor-mcp/executeEditorMcpCommandFx", async () => {
	const { Effect } = await import("effect");
	return {
		executeEditorMcpCommandFx: () =>
			Effect.sync(() => ({
				overview: bridge.overview,
				secret: "arkini_mcp_generated",
			})),
	};
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
});

describe("EditorMcpCommandAtom", () => {
	it("refreshes a remounted workspace without discarding its undismissed password", async () => {
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
				secret: "arkini_mcp_generated",
			}),
		);

		bridge.overview = {
			...bridge.overview,
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
			secret: "arkini_mcp_generated",
			overview: {
				remote: {
					type: "unavailable",
				},
			},
		});
	});
});
