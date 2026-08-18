// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	estimateState: undefined as unknown,
}));

vi.mock("~/ui/item/editor/useEditorItemEstimate", () => ({
	useEditorItemEstimate: () => state.estimateState,
}));

vi.mock("~/ui/item/editor/EditorItemDetailReference", () => ({
	EditorItemDetailReference: ({
		item,
	}: {
		readonly item: {
			readonly id: string;
			readonly title: string;
		};
	}) =>
		createElement(
			"a",
			{
				"data-item-id": item.id,
			},
			item.title,
		),
}));

import type { EditorProject } from "~/bridge/editor/EditorProject";
import { EditorProjectContext } from "~/bridge/editor/EditorProjectContext";
import type { EditorItemEstimate } from "~/editor/estimator/EditorItemEstimate";
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

const render = async (
	estimateState: unknown,
	{
		config = createJobTestConfig(),
		itemId = "tool",
	}: {
		readonly config?: EditorProject["config"];
		readonly itemId?: string;
	} = {},
) => {
	const project: EditorProject = {
		config,
		createdAtMs: 1,
		game: "1.0",
		projectId: "estimate-test",
		resources: [],
		revision: 0,
		title: "Estimate test",
		updatedAtMs: 1,
	};
	state.estimateState = estimateState;
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
					itemId,
				}),
			),
		);
	});
	return container;
};

describe("EditorItemEstimateSection", () => {
	it("renders static duration and requirement classes", async () => {
		const estimate: EditorItemEstimate = {
			diagnostics: [],
			durationMs: 1_000,
			factId: "tool",
			limitations: [
				"spatial-requirements-approximated",
			],
			obtainable: true,
			status: "complete",
			quantity: 1,
			route: {
				actionRuns: 1,
				durationMs: 1_000,
				factId: "tool",
				outputRuns: 1,
				quantity: 1,
				requirements: [
					{
						acquisitionFactId: "water",
						factId: "water",
						quantity: 3,
						sources: [
							"material-input",
						],
						usage: "consume",
					},
				],
				rootQuantity: 0,
				routeId: "line:forge:tool",
				source: "route",
			},
			routeSteps: [
				{
					actionRuns: 1,
					durationMs: 1_000,
					factId: "tool",
					outputRuns: 1,
					quantity: 1,
					requirements: [
						{
							acquisitionFactId: "water",
							factId: "water",
							quantity: 3,
							sources: [
								"material-input",
							],
							usage: "consume",
						},
					],
					rootQuantity: 0,
					routeId: "line:forge:tool",
					source: "route",
				},
				{
					actionRuns: 1,
					durationMs: 500,
					factId: "water",
					outputRuns: 1,
					quantity: 3,
					requirements: [],
					rootQuantity: 0,
					routeId: "line:well:water",
					source: "route",
				},
			],
		};
		const container = await render({
			estimate,
			status: "ready",
		});

		expect(container.textContent).toContain("Complete path found");
		expect(container.textContent).toContain("1 s");
		expect(container.textContent).toContain("Static dependency estimator");
		expect(container.textContent).toContain("line:well:water");
		expect(container.textContent).toContain("Scope, distance, board capacity");
		expect(container.textContent).toContain("Optimistic authored-graph analysis");
		expect(container.textContent).not.toContain("planner");
		expect(container.textContent).not.toContain("search");
	});

	it("renders explicit unreachable diagnostics", async () => {
		const estimate: EditorItemEstimate = {
			diagnostics: [
				{
					factId: "tool",
					kind: "unreachable",
					quantity: 1,
				},
			],
			factId: "tool",
			limitations: [],
			obtainable: false,
			status: "unreachable",
			quantity: 1,
		};
		const container = await render({
			estimate,
			status: "ready",
		});

		expect(container.textContent).toContain("No complete path");
		expect(container.textContent).toContain("tool × 1 has no complete acquisition route");
	});

	it("renders bounded-analysis failures without claiming totals", async () => {
		const estimate: EditorItemEstimate = {
			diagnostics: [
				{
					kind: "joint-output-accounting-unsupported",
					reason: "state-space",
					routeId: "line:forge:run",
				},
			],
			factId: "tool",
			limitations: [],
			obtainable: false,
			quantity: 1,
			status: "partial",
		};
		const container = await render({
			estimate,
			status: "ready",
		});

		expect(container.textContent).toContain("Incomplete static path");
		expect(container.textContent).toContain("Indeterminate");
		expect(container.textContent).toContain("exceeds the bounded static state space");
		expect(container.textContent).not.toContain("Consumed");
	});

	it("shows progress while the estimate worker is running", async () => {
		const container = await render({
			status: "loading",
		});

		expect(container.querySelector('[data-ui="EditorItemEstimateLoading"]')).not.toBeNull();
		expect(container.querySelector('[data-ui="EditorItemEstimateResult"]')).toBeNull();
	});
});
