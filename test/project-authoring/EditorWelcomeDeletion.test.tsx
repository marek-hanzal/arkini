// @vitest-environment jsdom

import { act, createElement, type AnchorHTMLAttributes, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EditorWelcome } from "~/project-authoring/welcome/EditorWelcome";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const actions = vi.hoisted(() => ({
	active: null as null | string,
	blocked: false,
	createProject: vi.fn(),
	deletedProjectIds: new Set<string>() as ReadonlySet<string>,
	deleteProject: vi.fn(),
	error: undefined as unknown,
	exit: vi.fn(),
	importArkpackFile: vi.fn(),
	importJsonDirectory: vi.fn(),
	openProjectFolder: vi.fn(),
	projectRefreshError: undefined as unknown,
	refreshingProjects: false,
	refreshProjects: vi.fn(),
}));

vi.mock("~/project-authoring/welcome/useEditorWelcomeActions", () => ({
	useEditorWelcomeActions: () => actions,
}));

vi.mock("~/ui/button/Button", async (importOriginal) => {
	const original = await importOriginal<typeof import("~/ui/button/Button")>();
	return {
		...original,
		ButtonLink: ({
			children,
			cursorIntent: _cursorIntent,
			params: _params,
			to: _to,
			...props
		}: AnchorHTMLAttributes<HTMLAnchorElement> & {
			readonly children?: ReactNode;
			readonly cursorIntent?: string;
			readonly params?: unknown;
			readonly to?: string;
		}) => createElement("a", props, children),
	};
});

const roots: Array<ReturnType<typeof createRoot>> = [];

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	actions.deleteProject.mockReset();
	actions.openProjectFolder.mockReset();
	actions.refreshProjects.mockReset();
	document.body.replaceChildren();
});

const findButton = (container: ParentNode, label: string) => {
	const button = Array.from(container.querySelectorAll("button")).find(
		(candidate) => candidate.textContent?.trim() === label,
	);
	if (!(button instanceof HTMLButtonElement)) throw new Error(`Button ${label} missing.`);
	return button;
};

describe("EditorWelcome project rows", () => {
	it("confirms the exact selected project deletion command", async () => {
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => {
			root.render(
				createElement(EditorWelcome, {
					recentProjects: [
						{
							type: "valid",
							ownership: "managed",
							project: {
								projectId: "project-one",
								title: "Arkini",
								version: "1.0",
								createdAtMs: 1,
								updatedAtMs: 2,
							},
						},
						{
							type: "valid",
							ownership: "external",
							project: {
								projectId: "project-two",
								title: "Custom folder",
								version: "1.0",
								createdAtMs: 1,
								updatedAtMs: 1,
							},
						},
					],
				}),
			);
		});

		const managedDelete = container.querySelector(
			'[data-project-ownership="managed"] [data-ui="EditorRecentProjectDelete"]',
		);
		const externalDelete = container.querySelector(
			'[data-project-ownership="external"] [data-ui="EditorRecentProjectDelete"]',
		);
		if (!(managedDelete instanceof HTMLButtonElement))
			throw new Error("Managed project delete action missing.");
		if (!(externalDelete instanceof HTMLButtonElement))
			throw new Error("Folder project delete action missing.");
		await act(async () => managedDelete.click());

		const dialog = container.querySelector('[data-ui="EditorProjectDeleteDialog"]');
		expect(dialog?.textContent).toContain("Arkini");
		expect(dialog?.textContent).toContain("project-one");
		expect(dialog?.getAttribute("data-project-ownership")).toBe("managed");
		expect(actions.deleteProject).not.toHaveBeenCalled();

		await act(async () => findButton(container, "Cancel").click());
		expect(container.querySelector('[data-ui="EditorProjectDeleteDialog"]')).toBeNull();
		expect(actions.deleteProject).not.toHaveBeenCalled();

		await act(async () => externalDelete.click());
		expect(
			container
				.querySelector('[data-ui="EditorProjectDeleteDialog"]')
				?.getAttribute("data-project-ownership"),
		).toBe("external");
		await act(async () => findButton(container, "Cancel").click());

		await act(async () => managedDelete.click());
		await act(async () => findButton(container, "Remove project").click());
		expect(actions.deleteProject).toHaveBeenCalledOnce();
		expect(actions.deleteProject).toHaveBeenCalledWith("project-one");
	});

	it("blocks invalid project entry and exposes only its exact folder plus list refresh", async () => {
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => {
			root.render(
				createElement(EditorWelcome, {
					recentProjects: [
						{
							type: "invalid",
							root: "/projects/broken",
							title: "broken",
							validationError: "game.json is invalid",
						},
					],
				}),
			);
		});

		const invalidRow = container.querySelector('[data-ui="EditorInvalidProject"]');
		expect(invalidRow?.textContent).toContain("/projects/broken");
		expect(invalidRow?.textContent).toContain("game.json is invalid");
		expect(invalidRow?.querySelector("a")).toBeNull();
		expect(invalidRow?.querySelector('[data-ui="EditorRecentProjectDelete"]')).toBeNull();

		await act(async () => findButton(invalidRow!, "Open folder").click());
		expect(actions.openProjectFolder).toHaveBeenCalledWith("/projects/broken");
		await act(async () => findButton(container, "Refresh").click());
		expect(actions.refreshProjects).toHaveBeenCalledOnce();
	});
});
