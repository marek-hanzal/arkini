// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Effect } from "effect";

const state = vi.hoisted(() => ({
	estimateState: undefined as unknown,
}));

vi.mock("~/ui/item/editor/useEditorItemEstimate", () => ({
	useEditorItemEstimate: () => state.estimateState,
}));

vi.mock("~/ui/item/editor/EditorItemDetailReference", () => ({
	EditorItemDetailReference: ({
		item,
		projectId,
		sectionId,
	}: {
		readonly item: {
			readonly id: string;
			readonly title: string;
		};
		readonly projectId: string;
		readonly sectionId?: string;
	}) =>
		createElement(
			"a",
			{
				"data-item-id": item.id,
				"data-project-id": projectId,
				"data-section-id": sectionId,
			},
			item.title,
		),
}));

import type { EditorProject } from "~/bridge/editor/EditorProject";
import { simulateEditorItemFx } from "~/editor/simulator/simulateEditorItemFx";
import { EditorProjectContext } from "~/bridge/editor/EditorProjectContext";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { formatItemDurationFx } from "~/ui/item-detail/formatItemDurationFx";
import { EditorItemEstimateSection } from "~/ui/item/editor/EditorItemEstimateSection";
import { createJobTestConfig } from "~test/job/support/jobTestConfig";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<ReturnType<typeof createRoot>> = [];

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
});

describe("EditorItemEstimateSection", () => {
	it("formats long estimates with hours", () => {
		expect(Effect.runSync(formatItemDurationFx(6_645_000))).toBe("1 h 50 min 45 s");
		expect(Effect.runSync(formatItemDurationFx(3_600_000))).toBe("1 h");
	});

	it("renders the shared total item cost in the Estimate section", async () => {
		const base = createJobTestConfig();
		const forge = base.items.forge;
		if (forge.type !== "producer") throw new Error("Expected producer fixture.");
		const config = GameConfigSchema.parse({
			...base,
			start: {
				...base.start,
				board: [
					{
						itemId: "forge",
						space: 0,
						x: 0,
						y: 0,
					},
				],
				inventory: [
					{
						itemId: "water",
						quantity: 3,
					},
					{
						itemId: "tool",
						quantity: 1,
					},
				],
			},
			items: {
				...base.items,
				forge: {
					...forge,
					lines: forge.lines.map((line) => ({
						...line,
						output: {
							set: [
								{
									roll: [
										{
											type: "guaranteed",
											drop: [
												{
													itemId: "ingot",
													quantity: {
														min: 1,
														max: 1,
													},
													rules: [],
												},
											],
										},
									],
								},
							],
						},
					})),
				},
				ingot: {
					...base.items.tool,
					uid: "ingot",
					id: "ingot",
					title: "Ingot",
				},
			},
		});
		const project: EditorProject = {
			projectId: "estimate-test",
			title: "Estimate test",
			game: "1.0",
			createdAtMs: 1,
			updatedAtMs: 1,
			revision: 0,
			config,
			resources: [],
		};
		state.estimateState = {
			estimate: await Effect.runPromise(simulateEditorItemFx(config, "ingot")),
			status: "ready",
		};
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => {
			root.render(
				createElement(
					EditorProjectContext.Provider,
					{
						value: project,
					},
					createElement(EditorItemEstimateSection, {
						itemId: "ingot",
					}),
				),
			);
		});

		const estimate = container.querySelector('[data-ui="EditorItemEstimateSection"]');
		const expected = container.querySelector('[data-scenario="expected"]');
		const method = container.querySelector('[data-ui="EditorItemEstimateMethod"]');
		if (estimate === null) throw new Error("Expected Estimate section.");
		expect(
			[
				...container.querySelectorAll('[data-ui="EditorItemEstimateScenario"]'),
			].map((card) => card.getAttribute("data-scenario")),
		).toEqual([
			"expected",
			"guaranteed",
		]);
		expect(estimate?.textContent).toContain("Estimated total cost");
		expect(estimate.textContent).not.toContain(
			"Consumed items across every sequential dependency operation.",
		);
		expect(estimate.textContent).not.toContain("Start items cost no time.");
		expect(expected?.textContent).toContain("3 items");
		expect(expected?.textContent).toContain("water");
		expect(expected?.textContent).toContain("× 3");
		expect(expected?.textContent).not.toContain(
			"Expected output yield is used, then batches are rounded up to whole runs.",
		);
		expect(expected?.querySelector('a[data-item-id="water"]')).not.toBeNull();
		expect(
			expected?.querySelector('a[data-item-id="water"]')?.getAttribute("data-section-id"),
		).toBe("estimate");
		expect(method?.textContent).toContain("How it is calculated");
		expect(method?.textContent).toContain(
			"Expected output yield is used, then batches are rounded up to whole runs.",
		);
		expect(method?.textContent).toContain(
			"Production, line rules, drop rules, runtime modifiers, and charges are simulated.",
		);
	});

	it("shows actionable blockers when no finite production path exists", async () => {
		const config = createJobTestConfig();
		const project: EditorProject = {
			projectId: "estimate-test",
			title: "Estimate test",
			game: "1.0",
			createdAtMs: 1,
			updatedAtMs: 1,
			revision: 0,
			config,
			resources: [],
		};
		state.estimateState = {
			estimate: await Effect.runPromise(simulateEditorItemFx(config, "tool")),
			status: "ready",
		};
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => {
			root.render(
				createElement(
					EditorProjectContext.Provider,
					{
						value: project,
					},
					createElement(EditorItemEstimateSection, {
						itemId: "tool",
					}),
				),
			);
		});

		const expected = container.querySelector('[data-scenario="expected"]');
		expect(expected?.textContent).toContain("1 production blocker");
		expect(expected?.textContent).toContain("Blocked");
		expect(expected?.textContent).toContain("Missing source");
		expect(expected?.textContent).toContain(
			"No starting quantity, production line, merge, or temporary expiry can create this item.",
		);
		expect(expected?.querySelector('a[data-item-id="tool"]')).not.toBeNull();
		expect(
			expected?.querySelector('a[data-item-id="tool"]')?.getAttribute("data-section-id"),
		).toBe("estimate");
		expect(expected?.textContent).not.toContain("No consumed items.");
	});

	it("shows progress while the estimate worker is running", async () => {
		state.estimateState = {
			status: "loading",
		};
		const base = createJobTestConfig();
		const project: EditorProject = {
			projectId: "estimate-test",
			title: "Estimate test",
			game: "1.0",
			createdAtMs: 1,
			updatedAtMs: 1,
			revision: 0,
			config: base,
			resources: [],
		};
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => {
			root.render(
				createElement(
					EditorProjectContext.Provider,
					{
						value: project,
					},
					createElement(EditorItemEstimateSection, {
						itemId: "tool",
					}),
				),
			);
		});

		expect(container.querySelector('[data-ui="EditorItemEstimateLoading"]')).not.toBeNull();
		expect(container.querySelector('[data-ui="EditorItemEstimateScenario"]')).toBeNull();
	});
});
