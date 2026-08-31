// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ItemEstimate } from "~/estimate/type/ItemEstimate";

const state = vi.hoisted(() => ({
	estimate: undefined as unknown,
}));

vi.mock("~/authoring-session/ui/useEditorProject", () => ({
	useEditorProject: () => ({
		config: {
			items: {},
		},
		projectId: "estimate-test",
	}),
}));

vi.mock("~/estimate/ui/useItemEstimate", () => ({
	useItemEstimate: () => state.estimate,
}));

vi.mock("~/estimate/ui/ItemEstimateRouteGraph", async () => {
	const { createElement } = await import("react");
	return {
		ItemEstimateRouteGraph: () =>
			createElement("div", {
				"data-ui": "CompletedEstimateRouteGraph",
			}),
	};
});

import { ItemEstimateSection } from "~/estimate/ui/ItemEstimateSection";

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

describe("ItemEstimateSection", () => {
	it("keeps a bounded partial estimate out of the completed route graph", async () => {
		const route = {
			actionRuns: 1,
			durationMs: 1,
			factId: "tool",
			outputRuns: 1,
			quantity: 1,
			requirements: [],
			rootQuantity: 0,
			routeId: "line:forge:run",
			source: "route" as const,
		};
		const complete: ItemEstimate = {
			diagnostics: [],
			durationMs: 1,
			factId: "tool",
			limitations: [],
			obtainable: true,
			quantity: 1,
			requirementSummary: {
				consumed: [],
				oneTime: [],
				ongoing: [],
			},
			route,
			routeSteps: [
				route,
			],
			status: "complete",
		};
		const partial: ItemEstimate = {
			diagnostics: [
				{
					factId: "tool",
					kind: "quantity-limit-exceeded",
					maximumQuantity: 10_000,
					quantity: 20_000,
					source: "authored-demand",
				},
			],
			factId: "tool",
			limitations: [],
			obtainable: false,
			quantity: 1,
			status: "partial",
		};
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);

		state.estimate = {
			estimate: complete,
			status: "ready",
		};
		await act(async () => {
			root.render(
				createElement(ItemEstimateSection, {
					itemId: "tool",
				}),
			);
		});
		expect(container.querySelector('[data-ui="CompletedEstimateRouteGraph"]')).not.toBeNull();

		state.estimate = {
			estimate: partial,
			status: "ready",
		};
		await act(async () => {
			root.render(
				createElement(ItemEstimateSection, {
					itemId: "tool",
				}),
			);
		});
		expect(container.querySelector('[data-ui="EditorItemEstimateHeader"]')).not.toBeNull();
		expect(container.querySelector('[data-ui="CompletedEstimateRouteGraph"]')).toBeNull();
	});
});
