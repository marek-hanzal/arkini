// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { EditorProject } from "~/bridge/editor/EditorProject";
import type { EditorItemEstimate } from "~/editor/estimator/EditorItemEstimate";
import type { EditorItemEstimateCacheAtom } from "~/ui/item/editor/EditorItemEstimateCacheAtom";

const testState = vi.hoisted(() => ({
	cache: {
		estimates: new Map(),
		status: "idle",
	} as EditorItemEstimateCacheAtom.State,
}));

vi.mock("@effect/atom-react", async (importOriginal) => ({
	...(await importOriginal<typeof import("@effect/atom-react")>()),
	useAtom: () => [
		testState.cache,
		vi.fn(),
	],
}));

import { useEditorItemEstimateIndex } from "~/ui/item/editor/useEditorItemEstimateIndex";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const route = {
	actionRuns: 1,
	durationMs: 1_000,
	factId: "item",
	outputRuns: 1,
	quantity: 1,
	requirements: [],
	rootQuantity: 0,
	routeId: "make:item",
	source: "route" as const,
};

const estimate: EditorItemEstimate = {
	diagnostics: [],
	durationMs: 1_000,
	factId: "item",
	limitations: [],
	obtainable: true,
	requirementSummary: {
		consumed: [],
		oneTime: [],
		ongoing: [],
	},
	quantity: 1,
	route,
	routeSteps: [
		route,
	],
	status: "complete",
};

const project = {
	config: {
		items: {
			item: {
				id: "item",
			},
		},
	},
	projectId: "project",
	revision: 1,
} as unknown as EditorProject;

const roots: Array<ReturnType<typeof createRoot>> = [];

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
});

const StateProbe = () => {
	const state = useEditorItemEstimateIndex(project);
	return createElement("span", null, `${state.status}:${state.entries.length}`);
};

describe("useEditorItemEstimateIndex", () => {
	it("keeps a stable hook order while the requested cache snapshot becomes ready", async () => {
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);

		testState.cache = {
			estimates: new Map(),
			status: "idle",
		};
		await act(async () => root.render(createElement(StateProbe)));
		expect(container.textContent).toBe("loading:0");

		testState.cache = {
			estimates: new Map(),
			snapshot: {
				config: project.config,
				projectId: project.projectId,
				revision: project.revision,
			},
			status: "loading",
		};
		await act(async () => root.render(createElement(StateProbe)));
		expect(container.textContent).toBe("loading:0");

		testState.cache = {
			estimates: new Map([
				[
					"item",
					estimate,
				],
			]),
			snapshot: {
				config: project.config,
				projectId: project.projectId,
				revision: project.revision,
			},
			status: "ready",
		};
		await act(async () => root.render(createElement(StateProbe)));
		expect(container.textContent).toBe("ready:1");
	});
});
