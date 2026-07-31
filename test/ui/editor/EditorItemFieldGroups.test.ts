// @vitest-environment jsdom

import { useStore } from "@tanstack/react-form";
import { act, createElement, Fragment, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("~/ui/resource/editor/EditorAssetAutocompleteField", () => ({
	EditorAssetAutocompleteField: ({ label }: { readonly label: string }) =>
		createElement("span", null, label),
}));

vi.mock("~/ui/item/editor/EditorSelectorControl", () => ({
	EditorSelectorControl: () => createElement("span", null, "Selector"),
}));

import { useAppForm } from "~/ui/form/EditorForm";
import type { EditorLine, EditorMerge } from "~/bridge/editor/EditorItemModel";
import { EditorItemArtworkFields } from "~/ui/item/editor/EditorItemArtworkFields";
import { EditorMergeFields } from "~/ui/item/editor/EditorMergeFields";
import { EditorProductionFields } from "~/ui/item/editor/EditorProductionFields";

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

const mount = async (element: ReactNode) => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	await act(async () => root.render(element));
	return container;
};

const click = async (container: HTMLElement, label: string) => {
	const button = [
		...container.querySelectorAll("button"),
	].find((candidate) => candidate.textContent === label);
	if (button === undefined) throw new Error(`Expected ${label} button.`);
	await act(async () => button.click());
};

const ArtworkHarness = () => {
	const form = useAppForm({
		defaultValues: {
			asset: {
				default: [
					"base",
				] as [
					string,
				],
				sources: [] as string[],
			},
		},
	});
	const values = useStore(form.store, (state) => state.values);
	const Group = () =>
		EditorItemArtworkFields({
			form,
			fields: "asset",
		});
	return createElement(
		Fragment,
		null,
		createElement(Group),
		createElement("output", null, JSON.stringify(values)),
	);
};

const MergeHarness = () => {
	const [merge, setMerge] = useState<Array<EditorMerge>>();
	return createElement(
		Fragment,
		null,
		createElement(EditorMergeFields, {
			onChange: setMerge,
			value: merge,
		}),
		createElement(
			"output",
			null,
			JSON.stringify({
				merge,
			}),
		),
	);
};

const ProductionHarness = () => {
	const form = useAppForm({
		defaultValues: {
			id: "item:ore",
			maxQueueSize: 1,
			lines: undefined as Array<EditorLine> | undefined,
		},
	});
	const values = useStore(form.store, (state) => state.values);
	const Group = () =>
		EditorProductionFields({
			form,
			fields: {
				maxQueueSize: "maxQueueSize",
				lines: "lines",
			},
			kind: "deposit",
			ownerId: values.id,
		});
	return createElement(
		Fragment,
		null,
		createElement(
			"button",
			{
				onClick: () => form.setFieldValue("id", "item:renamed"),
				type: "button",
			},
			"Rename owner",
		),
		createElement(Group),
		createElement("output", null, JSON.stringify(values)),
	);
};

describe("editor item field groups", () => {
	it("adds a second registered artwork layer", async () => {
		const container = await mount(createElement(ArtworkHarness));
		await click(container, "Add composite layer");

		expect(container.querySelector("output")?.textContent).toContain('"default":["base",""]');
	});

	it("creates the first registered merge entry", async () => {
		const container = await mount(createElement(MergeHarness));
		await click(container, "Add merge");

		expect(container.querySelector("output")?.textContent).toContain('"effect":"keep"');
	});

	it("creates unique deposit lines with only the first authored as default", async () => {
		const container = await mount(createElement(ProductionHarness));
		await click(container, "Add line");
		await click(container, "Add line");

		const values = JSON.parse(container.querySelector("output")?.textContent ?? "null") as {
			readonly lines: ReadonlyArray<EditorLine>;
		};
		expect(values.lines.map((line) => line.id)).toEqual([
			"line:ore:default",
			"line:ore:2",
		]);
		expect(values.lines.map((line) => line.default)).toEqual([
			true,
			false,
		]);
	});

	it("uses the current item ID when adding a line", async () => {
		const container = await mount(createElement(ProductionHarness));
		await click(container, "Rename owner");
		await click(container, "Add line");

		expect(container.querySelector("output")?.textContent).toContain(
			'"id":"line:renamed:default"',
		);
	});
});
