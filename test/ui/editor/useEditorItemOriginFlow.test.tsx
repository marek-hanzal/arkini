// @vitest-environment jsdom

import { RegistryContext, scheduleTask } from "@effect/atom-react";
import { Effect } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { EditorItemOriginFlow } from "~/bridge/item/editor/EditorItemOriginFlow";
import type { EditorItemOriginFlowRequest } from "~/bridge/item/editor/readEditorItemOriginFlowFx";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import type { EditorItemOriginFlowLayout } from "~/ui/item/editor/editorItemOriginFlowLayout";

const mocks = vi.hoisted(() => ({
	layout: vi.fn(),
	read: vi.fn(),
}));

vi.mock("~/bridge/item/editor/readEditorItemOriginFlowFx", async (importOriginal) => ({
	...(await importOriginal()),
	readEditorItemOriginFlowFx: mocks.read,
}));

vi.mock("~/ui/item/editor/layoutEditorItemOriginFlowInWorkerFx", () => ({
	layoutEditorItemOriginFlowInWorkerFx: mocks.layout,
}));

import { useEditorItemOriginFlow } from "~/ui/item/editor/useEditorItemOriginFlow";

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

const flowFor = (itemId: string): EditorItemOriginFlow => ({
	edges: [],
	nodes: [
		{
			id: `item:${itemId}`,
			itemId,
			operations: [],
			resourceIds: [
				itemId,
			],
			starterScopes: [],
			title: itemId,
			type: "producer",
		},
	],
});

const layoutFor = (itemId: string): EditorItemOriginFlowLayout => ({
	backbones: new Map(),
	positions: new Map([
		[
			`item:${itemId}`,
			{
				flowOrder: 0,
				height: 100,
				width: 100,
				x: 10,
				y: 20,
			},
		],
	]),
});

const createDeferred = <Value,>() => {
	let resolve: (value: Value) => void = () => undefined;
	const promise = new Promise<Value>((complete) => {
		resolve = complete;
	});
	return {
		promise,
		resolve,
	};
};

const renderProbe = async ({ itemId }: { readonly itemId: string }) => {
	const registry = AtomRegistry.make({
		scheduleTask,
	});
	registries.push(registry);
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	const state: {
		current?: ReturnType<typeof useEditorItemOriginFlow>;
	} = {};
	const Probe = ({ currentItemId }: { readonly currentItemId: string }) => {
		state.current = useEditorItemOriginFlow(Config, currentItemId);
		return createElement("div", {
			"data-status": state.current.status,
		});
	};
	const render = async (currentItemId: string) => {
		await act(async () => {
			root.render(
				createElement(
					RegistryContext.Provider,
					{
						value: registry,
					},
					createElement(Probe, {
						currentItemId,
					}),
				),
			);
			await new Promise((resolve) => setTimeout(resolve, 0));
		});
	};
	await render(itemId);
	return {
		render,
		root,
		state,
	};
};

describe("useEditorItemOriginFlow", () => {
	it("projects Atom-owned progress and publishes the completed current request", async () => {
		const layout = createDeferred<EditorItemOriginFlowLayout>();
		mocks.read.mockImplementation((request: EditorItemOriginFlowRequest) =>
			Effect.sync(() => {
				request.onProgress?.({
					label: "Tracing flow",
					percent: 50,
				});
				return flowFor(request.targetItemId ?? "all");
			}),
		);
		mocks.layout.mockImplementation(() => Effect.promise(() => layout.promise));

		const probe = await renderProbe({
			itemId: "wine",
		});

		expect(probe.state.current).toEqual(
			expect.objectContaining({
				progress: {
					label: "Laying out flow",
					percent: 95,
				},
				status: "loading",
			}),
		);

		await act(async () => {
			layout.resolve(layoutFor("wine"));
			await layout.promise;
			await new Promise((resolve) => setTimeout(resolve, 0));
		});

		expect(probe.state.current).toEqual(
			expect.objectContaining({
				flow: flowFor("wine"),
				progress: {
					label: "Flow ready",
					percent: 100,
				},
				status: "ready",
			}),
		);
	});

	it("projects a current flow failure without retaining stale flow data", async () => {
		mocks.read.mockImplementation((request: EditorItemOriginFlowRequest) =>
			Effect.succeed(flowFor(request.targetItemId ?? "all")),
		);
		mocks.layout.mockImplementation(() => Effect.fail(new Error("layout failed")));

		const probe = await renderProbe({
			itemId: "wine",
		});

		expect(probe.state.current).toEqual({
			flow: undefined,
			progress: {
				label: "Flow failed",
				percent: 0,
			},
			status: "error",
		});
	});

	it("interrupts a stale request and publishes only the newer routed item", async () => {
		let firstInterrupted = false;
		mocks.read.mockImplementation((request: EditorItemOriginFlowRequest) =>
			Effect.succeed(flowFor(request.targetItemId ?? "all")),
		);
		mocks.layout.mockImplementation((flow: EditorItemOriginFlow) =>
			flow.nodes[0]?.itemId === "wine"
				? Effect.never.pipe(
						Effect.onInterrupt(() =>
							Effect.sync(() => {
								firstInterrupted = true;
							}),
						),
					)
				: Effect.succeed(layoutFor("beer")),
		);

		const probe = await renderProbe({
			itemId: "wine",
		});
		expect(probe.state.current?.status).toBe("loading");

		await probe.render("beer");

		expect(firstInterrupted).toBe(true);
		expect(probe.state.current).toEqual(
			expect.objectContaining({
				flow: flowFor("beer"),
				status: "ready",
			}),
		);
	});

	it("keeps simultaneous hook instances in independent command scopes", async () => {
		let wineInterrupted = false;
		mocks.read.mockImplementation((request: EditorItemOriginFlowRequest) =>
			Effect.succeed(flowFor(request.targetItemId ?? "all")),
		);
		mocks.layout.mockImplementation((flow: EditorItemOriginFlow) =>
			flow.nodes[0]?.itemId === "wine"
				? Effect.never.pipe(
						Effect.onInterrupt(() =>
							Effect.sync(() => {
								wineInterrupted = true;
							}),
						),
					)
				: Effect.succeed(layoutFor("beer")),
		);

		const registry = AtomRegistry.make({
			scheduleTask,
		});
		registries.push(registry);
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		const states: Record<string, ReturnType<typeof useEditorItemOriginFlow> | undefined> = {};
		const Probe = ({ itemId }: { readonly itemId: string }) => {
			states[itemId] = useEditorItemOriginFlow(Config, itemId);
			return createElement("span", {
				"data-item-id": itemId,
			});
		};

		await act(async () => {
			root.render(
				createElement(
					RegistryContext.Provider,
					{
						value: registry,
					},
					createElement(
						"div",
						null,
						createElement(Probe, {
							itemId: "wine",
						}),
						createElement(Probe, {
							itemId: "beer",
						}),
					),
				),
			);
			await new Promise((resolve) => setTimeout(resolve, 0));
		});

		expect(wineInterrupted).toBe(false);
		expect(states.wine?.status).toBe("loading");
		expect(states.beer).toEqual(
			expect.objectContaining({
				flow: flowFor("beer"),
				status: "ready",
			}),
		);
	});

	it("interrupts the subscription-scoped flow command when its consumer unmounts", async () => {
		let interrupted = false;
		mocks.read.mockImplementation((request: EditorItemOriginFlowRequest) =>
			Effect.succeed(flowFor(request.targetItemId ?? "all")),
		);
		mocks.layout.mockImplementation(() =>
			Effect.never.pipe(
				Effect.onInterrupt(() =>
					Effect.sync(() => {
						interrupted = true;
					}),
				),
			),
		);

		const probe = await renderProbe({
			itemId: "wine",
		});
		expect(probe.state.current?.status).toBe("loading");

		await act(async () => {
			probe.root.unmount();
			await new Promise((resolve) => setTimeout(resolve, 0));
		});
		roots.splice(roots.indexOf(probe.root), 1);

		expect(interrupted).toBe(true);
	});
});
