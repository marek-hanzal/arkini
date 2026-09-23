import { parseVersionFn } from "~/game-version/fn/parseVersionFn";
// @vitest-environment jsdom

import { act, createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

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

import { TranslationTestProvider } from "~test/support/TranslationTestProvider";
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
});

describe("ProjectOverview", () => {
	it("routes project-wide card actions to the current project", async () => {
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);

		await act(async () =>
			root.render(
				<TranslationTestProvider>
					<ProjectOverview project={project} />
				</TranslationTestProvider>,
			),
		);

		const links = Array.from(
			container.querySelectorAll<HTMLAnchorElement>('[data-ui="EditorProjectOverviewLink"]'),
		);
		expect(links.map((link) => link.dataset.overviewId)).toEqual([
			"items",
			"artwork",
		]);
		expect(links.map((link) => link.dataset.to)).toEqual([
			"/editor/$projectId/editor/items/list",
			"/editor/$projectId/artwork",
		]);
		for (const link of links)
			expect(JSON.parse(link.dataset.params ?? "null")).toEqual({
				projectId: project.projectId,
			});
		expect(
			container.querySelector('[data-ui="EditorProjectOverview"]')?.firstElementChild,
		).toMatchObject({
			dataset: {
				projectId: project.projectId,
				ui: "EditorProjectNotesOverview",
			},
		});
	});
});
