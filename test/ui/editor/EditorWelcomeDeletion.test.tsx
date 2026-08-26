// @vitest-environment jsdom

import { act, createElement, type AnchorHTMLAttributes, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EditorWelcome } from "~/ui/editor/EditorWelcome";

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
	projectRefreshError: undefined as unknown,
	refreshingProjects: false,
	refreshProjects: vi.fn(),
}));

vi.mock("~/ui/editor/useEditorWelcomeActions", () => ({
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
	document.body.replaceChildren();
});

const findButton = (container: ParentNode, label: string) => {
	const button = Array.from(container.querySelectorAll("button")).find(
		(candidate) => candidate.textContent?.trim() === label,
	);
	if (!(button instanceof HTMLButtonElement)) throw new Error(`Button ${label} missing.`);
	return button;
};

describe("EditorWelcome project deletion", () => {
	it("explains managed deletion and external-folder removal before confirming", async () => {
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => {
			root.render(
				createElement(EditorWelcome, {
					recentProjects: [
						{
							projectId: "project-one",
							title: "Arkini",
							version: "1.0",
							createdAtMs: 1,
							updatedAtMs: 2,
						},
					],
				}),
			);
		});

		const openDelete = container.querySelector('[data-ui="EditorRecentProjectDelete"]');
		if (!(openDelete instanceof HTMLButtonElement))
			throw new Error("Recent project delete action missing.");
		await act(async () => openDelete.click());

		const dialog = container.querySelector('[data-ui="EditorProjectDeleteDialog"]');
		expect(dialog?.textContent).toContain("Arkini");
		expect(dialog?.textContent).toContain("project-one");
		expect(dialog?.textContent).toContain("Managed projects are permanently deleted");
		expect(dialog?.textContent).toContain("Folders opened from disk remain untouched");
		expect(actions.deleteProject).not.toHaveBeenCalled();

		await act(async () => findButton(container, "Cancel").click());
		expect(container.querySelector('[data-ui="EditorProjectDeleteDialog"]')).toBeNull();
		expect(actions.deleteProject).not.toHaveBeenCalled();

		await act(async () => openDelete.click());
		await act(async () => findButton(container, "Remove project").click());
		expect(actions.deleteProject).toHaveBeenCalledOnce();
		expect(actions.deleteProject).toHaveBeenCalledWith("project-one");
	});
});
