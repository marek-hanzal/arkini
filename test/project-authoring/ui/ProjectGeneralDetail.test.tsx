// @vitest-environment jsdom

import { act, createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const identityRename = vi.hoisted(() => ({
	cancelFn: vi.fn(),
	confirming: false,
	error: undefined,
	openFn: vi.fn(),
	pending: false,
	renameFn: vi.fn(),
}));

vi.mock("~/project-authoring/ui/ProjectOverview", () => ({
	ProjectOverview: () => null,
}));

vi.mock("~/project-authoring/ui/useProjectIdentityRenameController", () => ({
	useProjectIdentityRenameController: () => identityRename,
}));

vi.mock("~/project-authoring/ui/ProjectIdentityRenameDialog", () => ({
	ProjectIdentityRenameDialog: () => null,
}));

vi.mock("~/ui/ui/LinkButton", () => ({
	LinkButton: ({ children, ...props }: Record<string, unknown>) =>
		createElement("button", props, children as ReactNode),
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
	identityRename.openFn.mockReset();
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
		const rename = Array.from(container.querySelectorAll("button")).find(
			(button) => button.textContent === "Rename",
		);
		if (rename === undefined) throw new Error("Project ID rename action missing.");
		await act(async () => rename.click());
		expect(identityRename.openFn).toHaveBeenCalledOnce();
	});
});
