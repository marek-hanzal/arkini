// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProjectIdentityRenameDialog } from "~/project-authoring/ui/ProjectIdentityRenameDialog";
import type { Project } from "~/project-authoring/type/Project";
import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";
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

describe("ProjectIdentityRenameDialog", () => {
	it("requires a changed ID and submits the exact new package identity", async () => {
		const renameFn = vi.fn(async () => undefined);
		const project = {
			projectId: "project-old",
			title: "Old project",
			version: editorTestPayload.version,
			createdAtMs: 1,
			updatedAtMs: 2,
			revision: 3,
			config: {
				...editorTestPayload.config,
				meta: {
					...editorTestPayload.config.meta,
					id: "project-old",
				},
			},
			resources: editorTestPayload.resources,
		} satisfies Project;
		const controller = {
			cancelFn: vi.fn(),
			confirming: true,
			error: undefined,
			openFn: vi.fn(),
			pending: false,
			renameFn,
		};
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => {
			root.render(
				createElement(
					TranslationTestProvider,
					undefined,
					createElement(ProjectIdentityRenameDialog, {
						controller,
						project,
					}),
				),
			);
		});

		const input = container.querySelector<HTMLInputElement>('input[name="projectId"]');
		const submit = Array.from(container.querySelectorAll("button")).find(
			(button) => button.textContent === "Rename project",
		);
		if (input === null || submit === undefined) throw new Error("Rename form missing.");
		await act(async () => submit.click());
		expect(renameFn).not.toHaveBeenCalled();
		expect(input.dataset.uiInvalid).toBe("true");

		const valueSetter = Object.getOwnPropertyDescriptor(
			HTMLInputElement.prototype,
			"value",
		)?.set;
		if (valueSetter === undefined) throw new Error("Native input setter missing.");
		await act(async () => {
			valueSetter.call(input, "project-new");
			input.dispatchEvent(
				new Event("input", {
					bubbles: true,
				}),
			);
		});
		await act(async () => submit.click());

		expect(renameFn).toHaveBeenCalledWith("project-new");
	});
});
