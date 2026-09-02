// @vitest-environment jsdom

import { act, createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("~/project-authoring/ui/ProjectOverview", () => ({
	ProjectOverview: () => null,
}));

vi.mock("~/ui/ui/LinkButton", () => ({
	LinkButtonLink: ({ children, params, to, ...props }: Record<string, unknown>) =>
		createElement(
			"a",
			{
				...props,
				"data-params": JSON.stringify(params),
				"data-to": to,
			},
			children as ReactNode,
		),
}));

import { ProjectGeneralDetail } from "~/project-authoring/ui/ProjectGeneralDetail";
import type { Project } from "~/project-authoring/type/Project";
import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";

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

describe("ProjectGeneralDetail", () => {
	it("links each project capacity value to its exact detail section", async () => {
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
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

		await act(async () => root.render(<ProjectGeneralDetail project={project} />));

		const links = Array.from(container.querySelectorAll<HTMLAnchorElement>("a"));
		expect(links).toHaveLength(3);
		expect(links.map((link) => link.dataset.to)).toEqual([
			"/editor/$projectId/project/detail/$sectionId",
			"/editor/$projectId/project/detail/$sectionId",
			"/editor/$projectId/project/detail/$sectionId",
		]);
		expect(links.map((link) => JSON.parse(link.dataset.params ?? "null"))).toEqual([
			{
				projectId: project.projectId,
				sectionId: "board",
			},
			{
				projectId: project.projectId,
				sectionId: "inventory",
			},
			{
				projectId: project.projectId,
				sectionId: "toolbar",
			},
		]);
	});
});
