import { parseVersionFn } from "~/game-version/fn/parseVersionFn";
// @vitest-environment jsdom

import { act, createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ItemEstimateIndexRow } from "~/estimate/type/ItemEstimateIndex";

const state = vi.hoisted(() => ({
	estimate: {
		maximumDemand: 0,
		rows: [] as ItemEstimateIndexRow[],
		status: "loading" as "loading" | "ready",
	},
}));

vi.mock("~/estimate/ui/useItemEstimateIndex", () => ({
	useItemEstimateIndex: () => state.estimate,
}));

vi.mock("~/project-note/ui/ProjectNotesOverview", () => ({
	ProjectNotesOverview: ({ projectId }: { readonly projectId: string }) =>
		createElement("div", {
			"data-project-id": projectId,
			"data-ui": "EditorProjectNotesOverview",
		}),
}));

vi.mock("~/ui/ui/LinkButton", () => ({
	LinkButton: ({ children, cursorIntent: _cursorIntent, ...props }: Record<string, unknown>) =>
		createElement("button", props, children as ReactNode),
	LinkButtonLink: ({ children, params, search, to, ...props }: Record<string, unknown>) =>
		createElement(
			"a",
			{
				...props,
				"data-params": JSON.stringify(params),
				"data-search": JSON.stringify(search),
				"data-to": to,
			},
			children as ReactNode,
		),
}));

import { ProjectOverview } from "~/project-authoring/ui/ProjectOverview";
import type { Project } from "~/project-authoring/type/Project";
import {
	editorTestResources,
	editorTestPayload,
} from "~test/project-authoring/support/editorTestPayload";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const project = {
	projectId: "project-one",
	title: "Project one",
	version: parseVersionFn(editorTestPayload.version),
	createdAtMs: 1,
	updatedAtMs: 2,
	revision: 3,
	config: editorTestPayload.config,
	resources: editorTestResources,
} satisfies Project;

const roots: Array<ReturnType<typeof createRoot>> = [];

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
	state.estimate = {
		maximumDemand: 0,
		rows: [],
		status: "loading",
	};
});

describe("ProjectOverview", () => {
	it("routes every project-wide card action and preserves Estimate loading", async () => {
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);

		await act(async () => root.render(<ProjectOverview project={project} />));

		const links = Array.from(
			container.querySelectorAll<HTMLAnchorElement>('[data-ui="EditorProjectOverviewLink"]'),
		);
		expect(links.map((link) => link.dataset.overviewId)).toEqual([
			"items",
			"assets",
		]);
		expect(links.map((link) => link.dataset.to)).toEqual([
			"/editor/$projectId/editor/items/list",
			"/editor/$projectId/assets",
		]);
		for (const link of links)
			expect(JSON.parse(link.dataset.params ?? "null")).toEqual({
				projectId: project.projectId,
			});
		expect(container.textContent).toContain("Calculating…");
		expect(container.querySelector(".animate-spin")).not.toBeNull();
		expect(container.querySelector('[data-overview-id="unreachable-items"]')).toBeNull();
		expect(
			container.querySelector('[data-ui="EditorProjectOverview"]')?.firstElementChild,
		).toMatchObject({
			dataset: {
				projectId: project.projectId,
				ui: "EditorProjectNotesOverview",
			},
		});
	});

	it("links an actual unreachable count to the incomplete Estimate view", async () => {
		state.estimate = {
			maximumDemand: 0,
			rows: [
				{
					estimate: {
						demand: 0,
						itemId: editorTestPayload.config.items.water.id,
						method: "static",
						status: "unreachable",
					},
					item: editorTestPayload.config.items.water,
				},
			],
			status: "ready",
		};
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);

		await act(async () => root.render(<ProjectOverview project={project} />));

		const link = container.querySelector<HTMLAnchorElement>(
			'[data-overview-id="unreachable-items"]',
		);
		expect(link?.dataset.to).toBe("/editor/$projectId/estimate");
		expect(JSON.parse(link?.dataset.search ?? "null")).toEqual({
			view: "incomplete",
		});
	});
});
