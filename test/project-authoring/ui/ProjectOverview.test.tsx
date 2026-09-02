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
	versionStatus: {
		canCommit: true,
		currentBaseVersionId: "version-one" as string | undefined,
		currentFingerprint: "fingerprint",
		dirty: true,
		versionCount: 2,
	},
}));

vi.mock("~/estimate/ui/useItemEstimateIndex", () => ({
	useItemEstimateIndex: () => state.estimate,
}));

vi.mock("~/project-version/ui/useProjectVersionStatus", () => ({
	useProjectVersionStatus: () => ({
		status: "ready",
		versionStatus: state.versionStatus,
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
import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const project = {
	projectId: "project-one",
	title: "Project one",
	version: editorTestPayload.version,
	createdAtMs: 1,
	updatedAtMs: 2,
	revision: 3,
	config: editorTestPayload.config,
	resources: editorTestPayload.resources,
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
	state.versionStatus = {
		canCommit: true,
		currentBaseVersionId: "version-one",
		currentFingerprint: "fingerprint",
		dirty: true,
		versionCount: 2,
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
			"arkpack-version",
			"versions-commit",
			"versions-history",
			"versions",
			"items-type-simple",
			"items",
			"assets",
		]);
		expect(links.map((link) => link.dataset.to)).toEqual([
			"/editor/$projectId/build",
			"/editor/$projectId/versions/commit",
			"/editor/$projectId/versions/history",
			"/editor/$projectId/versions/commit",
			"/editor/$projectId/editor/items/list",
			"/editor/$projectId/editor/items/list",
			"/editor/$projectId/assets",
		]);
		for (const link of links)
			expect(JSON.parse(link.dataset.params ?? "null")).toEqual({
				projectId: project.projectId,
			});
		expect(JSON.parse(links[4]?.dataset.search ?? "null")).toEqual({
			itemType: "simple",
		});
		expect(container.textContent).toContain("Calculating…");
		expect(container.querySelector(".animate-spin")).not.toBeNull();
		expect(container.querySelector('[data-overview-id="unreachable-items"]')).toBeNull();
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

	it("keeps Commit unavailable when the working copy has no changes", async () => {
		state.versionStatus = {
			...state.versionStatus,
			canCommit: false,
			dirty: false,
		};
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);

		await act(async () => root.render(<ProjectOverview project={project} />));

		expect(
			container.querySelector<HTMLButtonElement>(
				'[data-ui="EditorProjectOverviewCommitUnavailable"]',
			)?.disabled,
		).toBe(true);
		expect(container.querySelector('[data-overview-id="versions-commit"]')).toBeNull();
	});
});
