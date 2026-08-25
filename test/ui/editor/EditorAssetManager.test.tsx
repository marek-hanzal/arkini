// @vitest-environment jsdom

import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { act, createElement, useState, type ButtonHTMLAttributes } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	project: undefined as unknown,
	result: undefined as unknown,
	saveAssets: vi.fn(),
	usages: [] as ReadonlyArray<{
		readonly resourceId: string;
	}>,
}));

vi.mock("@effect/atom-react", async (importOriginal) => ({
	...(await importOriginal<typeof import("@effect/atom-react")>()),
	useAtomSet: () => state.saveAssets,
	useAtomValue: () => state.result,
}));

vi.mock("~/bridge/editor/useEditorProject", () => ({
	useEditorProject: () => state.project,
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
	useEditorResourceUsages: () => state.usages,
}));

vi.mock("~/ui/button/Button", () => ({
	PrimaryButton: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) =>
		createElement("button", props, children),
}));

vi.mock("~/ui/resource/editor/EditorAssetCard", () => ({
	EditorAssetCard: ({
		resource,
	}: {
		readonly resource: {
			readonly id: string;
		};
	}) =>
		createElement("article", {
			"data-resource-id": resource.id,
		}),
}));

import { EditorAssetManager } from "~/ui/resource/editor/EditorAssetManager";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<ReturnType<typeof createRoot>> = [];

beforeEach(() => {
	state.result = AsyncResult.initial();
	state.saveAssets.mockReset();
	state.usages = [
		{
			resourceId: "hero",
		},
		{
			resourceId: "item-water",
		},
	];
	state.project = {
		projectId: "editor-test",
		resources: [
			{
				id: "hero",
				mime: "image/png",
				bytes: new Uint8Array([
					1,
				]),
			},
			{
				id: "item-water",
				mime: "image/png",
				bytes: new Uint8Array([
					2,
				]),
			},
			{
				id: "unused-tree",
				mime: "image/png",
				bytes: new Uint8Array([
					3,
				]),
			},
		],
	};
});

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
});

const AssetManagerHarness = () => {
	const [filter, setFilter] = useState<"all" | "unused">("all");
	const [query, setQuery] = useState("");
	return createElement(EditorAssetManager, {
		filter,
		query,
		onFilterChange: setFilter,
		onQueryChange: setQuery,
	});
};

const renderManager = async () => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	await act(async () => root.render(createElement(AssetManagerHarness)));
	return container;
};

const readResources = (container: HTMLElement) =>
	[
		...container.querySelectorAll<HTMLElement>("[data-resource-id]"),
	].map((element) => element.dataset.resourceId);

const click = async (element: Element | null) => {
	if (!(element instanceof HTMLElement)) throw new Error("Missing clickable element.");
	await act(async () => element.click());
};

const setSearch = async (container: HTMLElement, value: string) => {
	const input = container.querySelector<HTMLInputElement>('[data-ui="EditorAssetSearch"]');
	if (input === null) throw new Error("Missing asset search.");
	const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
	if (setter === undefined) throw new Error("Missing native input value setter.");
	await act(async () => {
		setter.call(input, value);
		input.dispatchEvent(
			new Event("input", {
				bubbles: true,
			}),
		);
	});
};

describe("EditorAssetManager", () => {
	it("composes shared Fuse search with the canonical unused-resource projection", async () => {
		const container = await renderManager();
		expect(readResources(container)).toEqual([
			"hero",
			"item-water",
			"unused-tree",
		]);

		await click(container.querySelector('button[data-filter="unused"]'));
		expect(readResources(container)).toEqual([
			"unused-tree",
		]);

		await setSearch(container, "water");
		expect(readResources(container)).toEqual([]);
		expect(container.querySelector('[data-ui="EditorAssetsFilteredEmpty"]')).not.toBeNull();

		const picker = container.querySelector<HTMLInputElement>(
			'[data-ui="EditorAssetImportInput"]',
		);
		expect(picker?.multiple).toBe(true);
		expect(picker?.accept).toContain("image/png");
		expect(
			container.querySelector<HTMLInputElement>('[data-ui="EditorAssetArkpackInput"]')
				?.accept,
		).toContain(".arkpack");
	});

	it("renders one deliberate import action for an empty project", async () => {
		state.project = {
			projectId: "editor-test",
			resources: [],
		};
		state.usages = [];
		const container = await renderManager();

		expect(container.querySelector('[data-ui="EditorAssetsEmpty"]')).not.toBeNull();
		expect(container.querySelectorAll('[data-ui="EditorAssetImport"]')).toHaveLength(1);
	});
});
