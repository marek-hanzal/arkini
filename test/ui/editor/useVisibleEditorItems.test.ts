// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useVisibleEditorItems } from "~/ui/item/editor/useVisibleEditorItems";

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

const roots: Array<ReturnType<typeof createRoot>> = [];

const createItem = (id: string, title: string) => ({
	uid: id,
	id,
	type: "simple" as const,
	title,
	description: `${title}.`,
	asset: {
		default: [
			"asset:test",
		],
	},
	tags: [],
	categoryId: "category:test",
	scope: "any" as const,
	maxStackSize: 1,
});

beforeEach(() => {
	state.project = {
		projectId: "editor-test",
		config: {
			items: {
				"item:canonical": createItem("item:canonical", "Canonical"),
				"item:renamed": createItem("item:renamed", "Old rename target"),
			},
		},
	};
	state.staged = {};
});

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
});

const Probe = () => {
	const items = useVisibleEditorItems();
	return createElement(
		"output",
		null,
		JSON.stringify(
			Object.values(items)
				.map(({ id, title }) => [
					id,
					title,
				])
				.sort(([left], [right]) => left.localeCompare(right)),
		),
	);
};

describe("useVisibleEditorItems", () => {
	it("overlays staged items without mutating the canonical project", async () => {
		state.staged = {
			"item:canonical": {
				item: createItem("item:canonical", "Staged"),
				sourceItemId: "item:canonical",
			},
			"item:renamed": {
				item: createItem("item:new-id", "Renamed"),
				sourceItemId: "item:renamed",
			},
		};
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);

		await act(async () => {
			root.render(createElement(Probe));
		});

		expect(JSON.parse(container.textContent ?? "[]")).toEqual([
			[
				"item:canonical",
				"Staged",
			],
			[
				"item:new-id",
				"Renamed",
			],
		]);
		expect(
			(state.project as {
				readonly config: {
					readonly items: Readonly<Record<string, { readonly title: string }>>;
				};
			}).config.items["item:canonical"]?.title,
		).toBe("Canonical");
	});
});
