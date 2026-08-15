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
		const result = container.querySelector('[data-ui="EditorItemEstimateResult"]');
		const method = container.querySelector('[data-ui="EditorItemEstimateMethod"]');
		if (method === null) throw new Error("Expected estimate method card.");
		if (estimate === null) throw new Error("Expected Estimate section.");
		expect(container.querySelectorAll('[data-ui="EditorItemEstimateResult"]')).toHaveLength(1);
		expect(estimate?.textContent).toContain("Estimated total cost");
		expect(result?.textContent).toContain("Expected");
		expect(estimate.textContent).not.toContain("Guaranteed");
		expect(estimate.textContent).not.toContain(
			"Consumed items across every sequential dependency operation.",
		);
		expect(estimate.textContent).not.toContain("Start items cost no time.");
		expect(result?.textContent).toContain("3 items");
		expect(result?.textContent).toContain("water");
		expect(result?.textContent).toContain("× 3");
		expect(result?.querySelector('a[data-item-id="water"]')).not.toBeNull();
		expect(
			result?.querySelector('a[data-item-id="water"]')?.getAttribute("data-section-id"),
		).toBe("estimate");
		expect(method?.textContent).toContain("Engine-backed planner");
		expect(method?.textContent).toContain("Deterministic witness");
		expect(method?.textContent).toContain(
			"The real engine completed a deterministic production witness.",
		);
		expect(method?.textContent).toContain("Concrete witness: 1 actions, 1 s.");
		expect(method?.textContent).toContain("Expected replay: 1 actions, 1 s.");
		expect(method?.textContent).toContain("Strategy root: editor.");
		expect(method?.textContent).toContain("Algorithms used: editor → constructive.");
		expect(method?.textContent).not.toContain("Route plans:");
	});

	it("explains failed shorter plans and the winning authored detour", async () => {
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
			estimate: {
				blockers: [],
				cost: [],
				infrastructure: [
					{
						itemId: "tool",
						quantity: 1,
						readyAtMs: 2_000,
					},
				],
				infrastructureItemIds: new Set(),
				itemId: "tool",
				operations: [],
				planner: {
					assumptions: [],
					diagnostics: {
						attemptedRoutePlans: 2,
						routePlans: [
							{
								actionCount: 1,
								bestAvailableQuantity: 0,
								bestTraceActionIds: [
									'["line","short-producer","line:short-part"]',
								],
								blockedActionIds: [
									'["line","short-target-producer","line:short-target"]',
								],
								depthDiscrepancy: 0,
								detours: [],
								expandedStates: 2,
								frontierSize: 0,
								index: 1,
								maximumDetourDepth: 0,
								outcome: "search-exhausted",
								routeCount: 1,
								routeDiscrepancy: 0,
								targetRouteId: "route:short-target",
								unsupportedActionIds: [],
								visitedStates: 2,
							},
							{
								actionCount: 3,
								bestAvailableQuantity: 1,
								bestTraceActionIds: [
									'["line","detour-target-producer","line:detour-target"]',
								],
								blockedActionIds: [],
								depthDiscrepancy: 1,
								detours: [
									{
										alternativeCount: 2,
										alternativeIndex: 1,
										depthExcess: 1,
										itemId: "tool",
										key: '["acquisition-route","tool"]',
										minimumDepth: 1,
										routeId: "route:detour-target",
										selectedDepth: 2,
										type: "acquisition-route",
									},
								],
								expandedStates: 3,
								frontierSize: 0,
								index: 2,
								maximumDetourDepth: 1,
								outcome: "completed",
								routeCount: 3,
								routeDiscrepancy: 1,
								targetRouteId: "route:detour-target",
								unsupportedActionIds: [],
								visitedStates: 3,
							},
						],
						winningRoutePlanIndex: 2,
					},
					expectedActionRuns: 3,
					expectedSpentCharges: [],
					expandedStates: 5,
					method: "engine-backed-search",
					observedActionRuns: 3,
					observedRuntimeMs: 300,
					outputCertainty: "deterministic",
					selectedWitnessProbability: 1,
					type: "completed",
					visitedStates: 5,
				},
				quantity: 1,
				runtimeMs: 300,
				status: "estimated",
				totalCostQuantity: 0,
				warnings: [],
			},
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

		const method = container.querySelector('[data-ui="EditorItemEstimateMethod"]');
		const result = container.querySelector('[data-ui="EditorItemEstimateResult"]');
		expect(method?.textContent).toContain("Route plans: 2 tried; plan 2 completed.");
		expect(method?.textContent).toContain(
			"Plan 1: exhausted its candidate frontier after 2 expanded states; best target quantity 0; trace reached line:short-part.",
		);
		expect(method?.textContent).toContain(
			"Winning detour: acquire tool via alternative 2/2 (+1 depth).",
		);
		expect(result?.textContent).toContain("Built / acquired infrastructure");
		expect(result?.textContent).toContain("ready by 2 s");
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

		const result = container.querySelector('[data-ui="EditorItemEstimateResult"]');
		expect(result?.textContent).toContain("1 production blocker");
		expect(result?.textContent).toContain("Blocked");
		expect(result?.textContent).toContain("Missing source");
		expect(result?.textContent).toContain(
			"No authored start item or acquisition route can produce this dependency.",
		);
		expect(result?.querySelector('a[data-item-id="tool"]')).not.toBeNull();
		expect(
			result?.querySelector('a[data-item-id="tool"]')?.getAttribute("data-section-id"),
		).toBe("estimate");
		expect(result?.textContent).not.toContain("No consumed items.");
		expect(
			container.querySelector('[data-ui="EditorItemEstimateMethod"]')?.textContent,
		).toContain("Graph-certified result");
	});

	it("renders bounded search exhaustion as undecided rather than impossible", async () => {
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
			estimate: {
				blockers: [],
				cost: [],
				infrastructure: [],
				infrastructureItemIds: new Set(),
				itemId: "tool",
				operations: [],
				planner: {
					bestAvailableQuantity: 0,
					budgetLimit: "maximumExpandedStates",
					diagnostics: {
						attemptedRoutePlans: 1,
						routePlans: [
							{
								actionCount: 1,
								bestAvailableQuantity: 0,
								bestTraceActionIds: [],
								blockedActionIds: [],
								budgetLimit: "maximumExpandedStates",
								depthDiscrepancy: 0,
								detours: [],
								expandedStates: 1_000,
								frontierSize: 84,
								index: 1,
								maximumDetourDepth: 0,
								outcome: "search-budget",
								routeCount: 1,
								routeDiscrepancy: 0,
								unsupportedActionIds: [],
								visitedStates: 1_084,
							},
						],
					},
					expandedStates: 1_000,
					method: "engine-backed-search",
					reason: "search-budget",
					type: "inconclusive",
					visitedStates: 1_084,
				},
				quantity: 1,
				status: "inconclusive",
				totalCostQuantity: 0,
				warnings: [
					"Feasibility is inconclusive because the search exhausted maximumExpandedStates.",
				],
			},
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

		const result = container.querySelector('[data-ui="EditorItemEstimateResult"]');
		const method = container.querySelector('[data-ui="EditorItemEstimateMethod"]');
		if (method === null) throw new Error("Expected estimate method card.");
		expect(result?.textContent).toContain("Estimate inconclusive");
		expect(result?.textContent).toContain("Undecided");
		expect(result?.textContent).toContain("This is not proof that the item is impossible.");
		expect(result?.textContent).not.toContain("No finite production path found");
		expect(method?.textContent).toContain("Bounded engine search");
		expect(method?.textContent).toContain("Undecided, not impossible");
		expect(method?.textContent).toContain("Budget limit: maximumExpandedStates.");
		expect(method?.textContent).toContain("Route plans: 1 tried; no plan completed.");
		expect(method?.textContent).toContain(
			"Plan 1: hit its search budget after 1000 expanded states; best target quantity 0.",
		);
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
		expect(container.querySelector('[data-ui="EditorItemEstimateResult"]')).toBeNull();
	});
});
