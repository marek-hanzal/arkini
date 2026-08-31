// @vitest-environment jsdom

import { act, createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	file: undefined as File | undefined,
}));

vi.mock("~/asset-authoring/ui/useEditorAssetEditController", () => ({
	useEditorAssetEditController: () => ({
		currentUrl: "blob:canonical",
		dirty: true,
		error: undefined,
		file: state.file,
		nextId: "hero",
		projectId: "project",
		resourceFound: true,
		save: vi.fn().mockResolvedValue(true),
		saving: false,
		setFile: vi.fn(),
		setNextId: vi.fn(),
	}),
}));

vi.mock("~/authoring-shell/ui/EditorHistoryBackButton", () => ({
	EditorHistoryBackButton: () => null,
}));

vi.mock("~/authoring-shell/ui/EditorSectionNavigation", () => ({
	EditorSectionNavigation: ({ action }: { readonly action?: ReactNode }) => action,
}));

vi.mock("~/authoring-shell/ui/EditorSectionPage", () => ({
	EditorSectionPage: ({
		children,
		tabs,
	}: {
		readonly children?: ReactNode;
		readonly tabs?: ReactNode;
	}) => createElement("div", null, tabs, children),
}));

vi.mock("~/ui/form/EditorFormContent", () => ({
	EditorFormContent: ({ children }: { readonly children?: ReactNode }) => children,
}));

import { EditorAssetEdit } from "~/asset-authoring/ui/EditorAssetEdit";

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
	state.file = undefined;
	document.body.replaceChildren();
	vi.restoreAllMocks();
});

describe("EditorAssetEdit", () => {
	it("owns the selected local PNG URL until unmount", async () => {
		const createObjectUrl = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:selected");
		const revokeObjectUrl = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		state.file = new File(
			[
				"png",
			],
			"replacement.png",
			{
				type: "image/png",
			},
		);

		await act(async () =>
			root.render(
				createElement(EditorAssetEdit, {
					filter: "all",
					query: "",
					resourceId: "hero",
				}),
			),
		);
		expect(createObjectUrl).toHaveBeenCalledWith(state.file);

		await act(async () => root.unmount());
		roots.pop();
		expect(revokeObjectUrl).toHaveBeenCalledWith("blob:selected");
	});
});
