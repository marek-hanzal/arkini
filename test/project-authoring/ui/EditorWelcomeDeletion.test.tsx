// @vitest-environment jsdom

import { act, createElement, type AnchorHTMLAttributes, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EditorWelcome } from "~/project-authoring/ui/EditorWelcome";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const actions = vi.hoisted(() => ({
	active: null as null | string,
	blocked: false,
	createProjectFn: vi.fn(),
	deletedProjectIds: new Set<string>() as ReadonlySet<string>,
	deleteProjectFn: vi.fn(),
	error: undefined as unknown,
	exitFn: vi.fn(),
	importArkpackFileFn: vi.fn(),
	importJsonDirectoryFn: vi.fn(),
	openProjectFolderFn: vi.fn(),
	projectRefreshError: undefined as unknown,
	refreshingProjects: false,
	refreshProjectsFn: vi.fn(),
}));

vi.mock("~/project-authoring/ui/useEditorWelcomeActions", () => ({
	useEditorWelcomeActions: () => actions,
}));

vi.mock("~/ui/ui/Button", async (importOriginal) => {
	const original = await importOriginal<typeof import("~/ui/ui/Button")>();
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
	actions.createProjectFn.mockReset();
	actions.deleteProjectFn.mockReset();
	actions.openProjectFolderFn.mockReset();
	actions.refreshProjectsFn.mockReset();
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
	it("collects the chosen package identity before creating a project", async () => {
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => {
			root.render(
				createElement(EditorWelcome, {
					recentProjects: [],
				}),
			);
		});

		const open = container.querySelector('[data-ui="EditorProjectCreateOpen"]');
		if (!(open instanceof HTMLButtonElement)) throw new Error("New project action missing.");
		await act(async () => open.click());
		const input = container.querySelector<HTMLInputElement>('input[name="projectId"]');
		if (input === null) throw new Error("Project ID input missing.");
		const valueSetter = Object.getOwnPropertyDescriptor(
			HTMLInputElement.prototype,
			"value",
		)?.set;
		if (valueSetter === undefined) throw new Error("Native input setter missing.");
		await act(async () => {
			valueSetter.call(input, "game:chosen");
			input.dispatchEvent(
				new Event("input", {
					bubbles: true,
				}),
			);
		});
		await act(async () => findButton(container, "Create project").click());

		expect(actions.createProjectFn).toHaveBeenCalledWith("game:chosen");
	});

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
		expect(actions.deleteProjectFn).not.toHaveBeenCalled();

		await act(async () => findButton(container, "Cancel").click());
		expect(container.querySelector('[data-ui="EditorProjectDeleteDialog"]')).toBeNull();
		expect(actions.deleteProjectFn).not.toHaveBeenCalled();

		await act(async () => externalDelete.click());
		expect(
			container
				.querySelector('[data-ui="EditorProjectDeleteDialog"]')
				?.getAttribute("data-project-ownership"),
		).toBe("external");
		await act(async () => findButton(container, "Cancel").click());

		await act(async () => managedDelete.click());
		await act(async () => findButton(container, "Remove project").click());
		expect(actions.deleteProjectFn).toHaveBeenCalledOnce();
		expect(actions.deleteProjectFn).toHaveBeenCalledWith("project-one");
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
		expect(actions.openProjectFolderFn).toHaveBeenCalledWith("/projects/broken");
		await act(async () => findButton(container, "Refresh").click());
		expect(actions.refreshProjectsFn).toHaveBeenCalledOnce();
	});
});
