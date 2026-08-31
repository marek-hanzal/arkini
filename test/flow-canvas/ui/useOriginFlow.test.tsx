// @vitest-environment jsdom

import { RegistryContext, scheduleTask } from "@effect/atom-react";
import { Effect } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ItemOriginFlow } from "~/flow/type/ItemOriginFlow";
import type { ItemOriginFlowRequest } from "~/flow/fx/readItemOriginFlowFx";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { Layout } from "~/flow-layout/type/Layout";

const mocks = vi.hoisted(() => ({
	layout: vi.fn(),
	read: vi.fn(),
}));

vi.mock("~/flow/fx/readItemOriginFlowFx", async (importOriginal) => ({
	...(await importOriginal()),
	readItemOriginFlowFx: mocks.read,
}));
vi.mock("~/flow-layout/fx/layoutInWorkerFx", () => ({
	layoutInWorkerFx: mocks.layout,
}));

import { useOriginFlow } from "~/flow-canvas/ui/useOriginFlow";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<ReturnType<typeof createRoot>> = [];
const registries: AtomRegistry.AtomRegistry[] = [];

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	for (const registry of registries.splice(0)) registry.dispose();
	mocks.layout.mockReset();
	mocks.read.mockReset();
	document.body.replaceChildren();
});

const Config = {} as GameConfigSchema.Type;
const Flow: ItemOriginFlow = {
	edges: [],
	nodes: [
		{
			id: "item:tool",
			itemId: "tool",
			operations: [],
			resourceIds: [
				"tool",
			],
			starterScopes: [],
			title: "Tool",
			type: "producer",
		},
	],
};
const Layout: Layout = {
	backbones: new Map(),
	positions: new Map(),
};

const renderProbe = async () => {
	const registry = AtomRegistry.make({
		scheduleTask,
	});
	registries.push(registry);
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	const state: {
		current?: ReturnType<typeof useOriginFlow>;
	} = {};
	const Probe = () => {
		state.current = useOriginFlow(Config);
		return createElement("div");
	};
	await act(async () => {
		root.render(
			createElement(
				RegistryContext.Provider,
				{
					value: registry,
				},
				createElement(Probe),
			),
		);
	});
	return {
		root,
		state,
	};
};

describe("useOriginFlow", () => {
	it("publishes one complete globally laid-out flow", async () => {
		mocks.read.mockImplementation((request: ItemOriginFlowRequest) =>
			Effect.sync(() => {
				request.onProgressFn?.({
					label: "Indexing sources",
					percent: 50,
				});
				return Flow;
			}),
		);
		mocks.layout.mockReturnValue(Effect.succeed(Layout));

		const probe = await renderProbe();
		await vi.waitFor(() => expect(probe.state.current?.status).toBe("ready"));

		expect(mocks.read).toHaveBeenCalledWith(
			expect.objectContaining({
				config: Config,
			}),
		);
		expect(probe.state.current).toEqual(
			expect.objectContaining({
				flow: Flow,
				progress: {
					label: "Flow ready",
					percent: 100,
				},
				status: "ready",
			}),
		);
	});

	it("projects a layout failure without retaining stale flow data", async () => {
		mocks.read.mockReturnValue(Effect.succeed(Flow));
		mocks.layout.mockReturnValue(Effect.fail(new Error("layout failed")));

		const probe = await renderProbe();
		await vi.waitFor(() => expect(probe.state.current?.status).toBe("error"));

		expect(probe.state.current).toEqual({
			flow: undefined,
			progress: {
				label: "Flow failed",
				percent: 0,
			},
			status: "error",
		});
	});

	it("interrupts the subscription-scoped global flow when its consumer unmounts", async () => {
		let started = false;
		let interrupted = false;
		mocks.read.mockReturnValue(Effect.succeed(Flow));
		mocks.layout.mockReturnValue(
			Effect.sync(() => {
				started = true;
			}).pipe(
				Effect.flatMap(() => Effect.never),
				Effect.onInterrupt(() =>
					Effect.sync(() => {
						interrupted = true;
					}),
				),
			),
		);

		const probe = await renderProbe();
		await vi.waitFor(() => expect(started).toBe(true));
		await act(async () => {
			probe.root.unmount();
		});
		roots.splice(roots.indexOf(probe.root), 1);

		await vi.waitFor(() => expect(interrupted).toBe(true));
	});
});
