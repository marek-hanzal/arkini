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
const Flow: EditorItemOriginFlow = {
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
const Layout: EditorItemOriginFlowLayout = {
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
		current?: ReturnType<typeof useEditorItemOriginFlow>;
	} = {};
	const Probe = () => {
		state.current = useEditorItemOriginFlow(Config);
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
		await new Promise((resolve) => setTimeout(resolve, 0));
	});
	return {
		root,
		state,
	};
};

describe("useEditorItemOriginFlow", () => {
	it("publishes one complete globally laid-out flow", async () => {
		mocks.read.mockImplementation((request: EditorItemOriginFlowRequest) =>
			Effect.sync(() => {
				request.onProgress?.({
					label: "Indexing sources",
					percent: 50,
				});
				return Flow;
			}),
		);
		mocks.layout.mockReturnValue(Effect.succeed(Layout));

		const probe = await renderProbe();

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
		let interrupted = false;
		mocks.read.mockReturnValue(Effect.succeed(Flow));
		mocks.layout.mockReturnValue(
			Effect.never.pipe(
				Effect.onInterrupt(() =>
					Effect.sync(() => {
						interrupted = true;
					}),
				),
			),
		);

		const probe = await renderProbe();
		expect(probe.state.current?.status).toBe("loading");
		await act(async () => {
			probe.root.unmount();
			await new Promise((resolve) => setTimeout(resolve, 0));
		});
		roots.splice(roots.indexOf(probe.root), 1);

		expect(interrupted).toBe(true);
	});
});
