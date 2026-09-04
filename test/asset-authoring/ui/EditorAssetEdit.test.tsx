// @vitest-environment jsdom

import { act, createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	assetIdError: undefined as string | undefined,
	file: undefined as File | undefined,
	fileError: undefined as string | undefined,
}));

vi.mock("~/asset-authoring/ui/useEditorAssetEditController", () => ({
	useEditorAssetEditController: () => ({
		assetIdError: state.assetIdError,
		currentUrl: "blob:canonical",
		dirty: true,
		error: undefined,
		file: state.file,
		fileError: state.fileError,
		nextId: "hero",
		projectId: "project",
		resourceFound: true,
		saveFn: vi.fn().mockResolvedValue(true),
		saving: false,
		setFileFn: vi.fn(),
		setNextIdFn: vi.fn(),
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
		header,
	}: {
		readonly children?: ReactNode;
		readonly header?: ReactNode;
	}) => createElement("div", null, header, children),
}));

vi.mock("~/editor-control/ui/EditorFormContent", () => ({
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
	state.assetIdError = undefined;
	state.fileError = undefined;
	document.body.replaceChildren();
	vi.restoreAllMocks();
});

describe("EditorAssetEdit", () => {
	it("targets draft validation at the exact asset control", async () => {
		state.assetIdError = "Enter a value.";
		state.fileError = "Choose a valid PNG.";
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);

		await act(async () =>
			root.render(
				createElement(EditorAssetEdit, {
					filter: "all",
					query: "",
					resourceId: "hero",
				}),
			),
		);

		expect(container.querySelector('input[data-ui-invalid="true"]')).not.toBeNull();
		expect(
			container
				.querySelector('button[data-ui="EditorAssetImageDropZone"]')
				?.getAttribute("data-ui-invalid"),
		).toBe("true");
	});

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
