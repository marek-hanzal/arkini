// @vitest-environment jsdom

import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { act, type ChangeEvent } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	importArtwork: vi.fn(),
	optimizeResources: vi.fn(),
	setAtomCall: 0,
}));

vi.mock("@effect/atom-react", async (importOriginal) => ({
	...(await importOriginal<typeof import("@effect/atom-react")>()),
	useAtomSet: () =>
		[
			state.importArtwork,
			state.optimizeResources,
		][state.setAtomCall++] ?? state.importArtwork,
	useAtomValue: () => AsyncResult.initial(),
}));

vi.mock("~/artwork-authoring/ui/useEditorArtworkLibrary", () => ({
	useEditorArtworkLibrary: () => ({
		empty: false,
		projectId: "editor-test",
		projectRevision: 42,
		resources: [
			{
				size: 0,
				version: "1",
				id: "visible-one",
				type: "artwork",
			},
			{
				size: 0,
				version: "1",
				id: "visible-two",
				type: "artwork",
			},
		],
	}),
}));

import { useEditorArtworkManagerController } from "~/artwork-authoring/ui/useEditorArtworkManagerController";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

let root: ReturnType<typeof createRoot> | undefined;
let controller: ReturnType<typeof useEditorArtworkManagerController> | undefined;

const Probe = () => {
	controller = useEditorArtworkManagerController({
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
	state.importArtwork.mockReset();
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

describe("useEditorArtworkManagerController", () => {
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
			"artwork.png",
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

		expect(state.importArtwork).toHaveBeenNthCalledWith(1, {
			file: arkpack,
			projectId: "editor-test",
			source: "arkpack",
		});
		expect(state.importArtwork).toHaveBeenNthCalledWith(2, {
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
			kind: "optimize",
			resourceIds: [
				"visible-one",
				"visible-two",
			],
			type: "artwork",
		});
	});

	it("dismisses the persistent optimization result", () => {
		controller?.onOptimizationDismissFn();

		expect(state.optimizeResources).toHaveBeenCalledWith({
			kind: "dismiss",
		});
	});
});
