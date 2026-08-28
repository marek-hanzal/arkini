// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { EditorItemEstimate } from "~/editor/estimator/EditorItemEstimate";

const state = vi.hoisted(() => ({
	estimate: undefined as unknown,
}));

vi.mock("~/ui/editor/useEditorProject", () => ({
	useEditorProject: () => ({
		config: {
			items: {},
		},
		projectId: "estimate-test",
	}),
}));

vi.mock("~/ui/item/editor/useEditorItemEstimate", () => ({
	useEditorItemEstimate: () => state.estimate,
}));

vi.mock("~/ui/item/editor/EditorItemEstimateRouteGraph", async () => {
	const { createElement } = await import("react");
	return {
		EditorItemEstimateRouteGraph: () =>
			createElement("div", {
				"data-ui": "CompletedEstimateRouteGraph",
			}),
	};
});

import { EditorItemEstimateSection } from "~/ui/item/editor/EditorItemEstimateSection";

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
	it("keeps a bounded partial estimate out of the completed route graph", async () => {
		const route = {
			actionRuns: 1,
			durationMs: 1,
			factId: "tool",
			occurrenceCount: 1,
			occurrenceId: "target",
			outputRuns: 1,
			quantity: 1,
			requirements: [],
			rootQuantity: 0,
			routeId: "line:forge:run",
			source: "route" as const,
		};
		const complete: EditorItemEstimate = {
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
		const partial: EditorItemEstimate = {
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
				createElement(EditorItemEstimateSection, {
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
				createElement(EditorItemEstimateSection, {
					itemId: "tool",
				}),
			);
		});
		expect(container.querySelector('[data-ui="EditorItemEstimateHeader"]')).not.toBeNull();
		expect(container.querySelector('[data-ui="CompletedEstimateRouteGraph"]')).toBeNull();
	});
});
