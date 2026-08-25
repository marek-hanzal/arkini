// @vitest-environment jsdom

import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { act, createElement, type ButtonHTMLAttributes } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	importAssets: vi.fn(),
	result: undefined as unknown,
}));

vi.mock("@effect/atom-react", async (importOriginal) => ({
	...(await importOriginal<typeof import("@effect/atom-react")>()),
	useAtomSet: () => state.importAssets,
	useAtomValue: () => state.result,
}));

vi.mock("~/bridge/editor/useEditorProject", () => ({
	useEditorProject: () => ({
		projectId: "editor-test",
		resources: [
			{
				id: "hero",
				mime: "image/png",
				bytes: new Uint8Array([
					1,
				]),
			},
		],
	}),
}));

vi.mock("~/ui/editor/EditorHistoryBackButton", () => ({
	EditorHistoryBackButton: () => createElement("span"),
}));

vi.mock("~/bridge/resource/editor/importEditorAssetsCommandAtom", () => ({
	importEditorAssetsCommandAtom: {
		key: "import-assets",
	},
}));

vi.mock("~/bridge/resource/editor/useEditorResourceUsages", () => ({
	useEditorResourceUsages: () => [],
}));

vi.mock("~/ui/button/Button", () => ({
	Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) =>
		createElement("button", props, children),
	PrimaryButton: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) =>
		createElement("button", props, children),
}));

vi.mock("~/ui/resource/editor/EditorAssetCard", () => ({
	EditorAssetCard: () => null,
}));

import { EditorAssetManager } from "~/ui/resource/editor/EditorAssetManager";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

let root: ReturnType<typeof createRoot> | undefined;

beforeEach(() => {
	state.importAssets.mockReset();
	state.result = AsyncResult.initial();
});

afterEach(async () => {
	await act(async () => root?.unmount());
	root = undefined;
	document.body.replaceChildren();
});

const renderManager = async () => {
	const container = document.createElement("div");
	document.body.append(container);
	root = createRoot(container);
	await act(async () =>
		root?.render(
			createElement(EditorAssetManager, {
				filter: "all",
				query: "",
				onFilterChange: vi.fn(),
				onQueryChange: vi.fn(),
			}),
		),
	);
	return container;
};

const selectFiles = async (input: HTMLInputElement, files: ReadonlyArray<File>) => {
	Object.defineProperty(input, "files", {
		configurable: true,
		value: files,
	});
	await act(async () =>
		input.dispatchEvent(
			new Event("change", {
				bubbles: true,
			}),
		),
	);
};

describe("EditorAssetManager import", () => {
	it("uses arkpack as the primary import and keeps PNG files in the dropdown", async () => {
		const container = await renderManager();
		const arkpackInput = container.querySelector<HTMLInputElement>(
			'[data-ui="EditorAssetArkpackInput"]',
		);
		const filesInput = container.querySelector<HTMLInputElement>(
			'[data-ui="EditorAssetImportInput"]',
		);
		if (arkpackInput === null || filesInput === null) throw new Error("Missing import inputs.");
		const arkpackClick = vi.fn();
		arkpackInput.addEventListener("click", arkpackClick);

		await act(async () =>
			container.querySelector<HTMLElement>('[data-ui="EditorAssetImport"]')?.click(),
		);
		expect(arkpackClick).toHaveBeenCalledOnce();

		const arkpack = new File(
			[
				Uint8Array.of(1),
			],
			"source.arkpack",
		);
		await selectFiles(arkpackInput, [
			arkpack,
		]);
		expect(state.importAssets).toHaveBeenLastCalledWith({
			file: arkpack,
			projectId: "editor-test",
			source: "arkpack",
		});

		await act(async () =>
			container
				.querySelector<HTMLElement>('[data-ui="EditorAssetImportMenuTrigger"]')
				?.click(),
		);
		const filesClick = vi.fn();
		filesInput.addEventListener("click", filesClick);
		await act(async () =>
			document
				.querySelector<HTMLElement>('[data-ui="EditorAssetImportFilesOption"]')
				?.click(),
		);
		expect(filesClick).toHaveBeenCalledOnce();

		const png = new File(
			[
				Uint8Array.of(2),
			],
			"asset.png",
			{
				type: "image/png",
			},
		);
		await selectFiles(filesInput, [
			png,
		]);
		expect(state.importAssets).toHaveBeenLastCalledWith({
			files: [
				png,
			],
			projectId: "editor-test",
			source: "files",
		});
	});
});
