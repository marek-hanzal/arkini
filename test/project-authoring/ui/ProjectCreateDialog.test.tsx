// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProjectRepositoryError } from "~/project-authoring/error/ProjectRepositoryError";
import { ProjectCreateDialog } from "~/project-authoring/ui/ProjectCreateDialog";
import { TranslationTestProvider } from "~test/support/TranslationTestProvider";

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

describe("ProjectCreateDialog", () => {
	it("projects a repository identity collision onto the Project ID field", async () => {
		const createFn = vi.fn();
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		const renderDialog = (error?: unknown) =>
			root.render(
				createElement(
					TranslationTestProvider,
					undefined,
					createElement(ProjectCreateDialog, {
						error,
						onCancelFn: vi.fn(),
						onCreateFn: createFn,
						pending: false,
					}),
				),
			);

		await act(async () => renderDialog());
		const input = container.querySelector<HTMLInputElement>('input[name="projectId"]');
		const submit = Array.from(container.querySelectorAll("button")).find(
			(button) => button.textContent === "Create project",
		);
		if (input === null || submit === undefined) throw new Error("Create form missing.");
		await act(async () => submit.click());
		expect(createFn).toHaveBeenCalledWith(input.value);

		await act(async () =>
			renderDialog(
				new ProjectRepositoryError({
					operation: "create-project",
					message: `Editor project ${input.value} already exists.`,
				}),
			),
		);
		await act(
			() =>
				new Promise<void>((resolve) => {
					requestAnimationFrame(() => resolve());
				}),
		);

		expect(input.dataset.uiInvalid).toBe("true");
		expect(container.textContent).toContain("A project with this ID already exists.");
		expect(document.activeElement).toBe(input);
	});
});
