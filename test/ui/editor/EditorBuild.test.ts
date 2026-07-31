// @vitest-environment jsdom

import { act, createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EditorBuild } from "~/ui/arkpack/editor/EditorBuild";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const state = vi.hoisted(() => ({
	project: undefined as unknown,
	staged: {} as Readonly<Record<string, unknown>>,
}));

vi.mock("~/bridge/editor/useEditorProject", () => ({
	useEditorProject: () => state.project,
}));

vi.mock("~/bridge/editor/useEditorProjectDraft", () => ({
	useEditorProjectDraft: () => state.staged,
}));

vi.mock("~/ui/button/Button", () => ({
	PrimaryButton: ({ children }: { readonly children?: ReactNode }) =>
		createElement("button", null, children),
}));

const roots: Array<ReturnType<typeof createRoot>> = [];

beforeEach(() => {
	state.project = {
		projectId: "editor-test",
		title: "Editor test",
		config: {
			items: {},
		},
		diagnostics: [
			{
				code: "test:warning",
				message: "Saved warning.",
				severity: "warning",
			},
		],
	};
	state.staged = {};
});

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
});

const renderBuild = async () => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	await act(async () => {
		root.render(createElement(EditorBuild));
	});
	return {
		container,
		root,
	};
};

describe("EditorBuild", () => {
	it("shows canonical validation as valid only when no staged changes exist", async () => {
		const { container } = await renderBuild();

		expect(container.textContent).toContain("Valid");
		expect(container.textContent).toContain("The saved project compiled successfully");
		expect(container.textContent).not.toContain("Drafts pending");
	});

	it("marks canonical diagnostics stale while staged item changes are pending", async () => {
		state.staged = {
			"item:test": {
				item: {
					id: "item:test",
				},
			},
		};
		const { container } = await renderBuild();

		expect(container.textContent).toContain("Drafts pending");
		expect(container.textContent).toContain("not included in this validation result");
		expect(container.textContent).toContain("Diagnostics from the last saved revision");
		expect(container.textContent).not.toContain("The saved project compiled successfully");
	});
});
