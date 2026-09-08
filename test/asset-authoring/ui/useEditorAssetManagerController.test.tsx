// @vitest-environment jsdom

import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { act, type ChangeEvent } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	importAssets: vi.fn(),
	optimizeResources: vi.fn(),
	setAtomCall: 0,
}));

vi.mock("@effect/atom-react", async (importOriginal) => ({
	...(await importOriginal<typeof import("@effect/atom-react")>()),
	useAtomSet: () =>
		[
			state.importAssets,
			state.optimizeResources,
		][state.setAtomCall++] ?? state.importAssets,
	useAtomValue: () => AsyncResult.initial(),
}));

vi.mock("~/asset-authoring/ui/useEditorAssetLibrary", () => ({
	useEditorAssetLibrary: () => ({
		empty: false,
		projectId: "editor-test",
		projectRevision: 42,
		resources: [
			{
				bytes: new Uint8Array(),
				id: "visible-one",
				mime: "image/png",
			},
			{
				bytes: new Uint8Array(),
				id: "visible-two",
				mime: "image/png",
			},
		],
	}),
}));

import { useEditorAssetManagerController } from "~/asset-authoring/ui/useEditorAssetManagerController";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

let root: ReturnType<typeof createRoot> | undefined;
let controller: ReturnType<typeof useEditorAssetManagerController> | undefined;

const Probe = () => {
	controller = useEditorAssetManagerController({
		filter: "all",
		query: "",
	});
	return null;
};

const changeEvent = (files: ReadonlyArray<File>) => {
	const input = document.createElement("input");
	Object.defineProperty(input, "files", {
		configurable: true,
		value: files,
	});
	return {
		currentTarget: input,
	} as ChangeEvent<HTMLInputElement>;
};

beforeEach(async () => {
	state.importAssets.mockReset();
	state.optimizeResources.mockReset();
	state.setAtomCall = 0;
	controller = undefined;
	const container = document.createElement("div");
	document.body.append(container);
	root = createRoot(container);
	await act(async () => root?.render(<Probe />));
});

afterEach(async () => {
	await act(async () => root?.unmount());
	root = undefined;
	document.body.replaceChildren();
});

describe("useEditorAssetManagerController", () => {
	it("admits arkpack and PNG imports with their exact command payloads", () => {
		const arkpack = new File(
			[
				Uint8Array.of(1),
			],
			"source.arkpack",
		);
		const png = new File(
			[
				Uint8Array.of(2),
			],
			"asset.png",
			{
				type: "image/png",
			},
		);

		controller?.onArkpackChangeFn(
			changeEvent([
				arkpack,
			]),
		);
		controller?.onFilesChangeFn(
			changeEvent([
				png,
			]),
		);

		expect(state.importAssets).toHaveBeenNthCalledWith(1, {
			file: arkpack,
			projectId: "editor-test",
			source: "arkpack",
		});
		expect(state.importAssets).toHaveBeenNthCalledWith(2, {
			files: [
				png,
			],
			projectId: "editor-test",
			source: "files",
		});
	});

	it("optimizes exactly the resources visible through the current collection", () => {
		controller?.onOptimizeFn();

		expect(state.optimizeResources).toHaveBeenCalledWith({
			expectedRevision: 42,
			resourceIds: [
				"visible-one",
				"visible-two",
			],
		});
	});
});
