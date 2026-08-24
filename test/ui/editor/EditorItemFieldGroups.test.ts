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

vi.mock("~/ui/item/editor/EditorDropList", () => ({
	EditorDropList: () => createElement("span", null, "Drops"),
}));

vi.mock("~/ui/item/editor/useEditorItemOptionLabel", () => ({
	useEditorItemOptionLabel: () => (itemId: string, fallback: string) => itemId || fallback,
}));

import { useAppForm } from "~/ui/form/EditorForm";
import type {
	EditorInput,
	EditorLine,
	EditorMerge,
	EditorRoll,
} from "~/bridge/item/editor/EditorItemModel";
import { EditorItemArtworkFields } from "~/ui/item/editor/EditorItemArtworkFields";
import { EditorInputCharges } from "~/ui/item/editor/EditorInputCharges";
import { EditorMergeFields } from "~/ui/item/editor/EditorMergeFields";
import { EditorProductionFields } from "~/ui/item/editor/EditorProductionFields";
import { EditorRollControl } from "~/ui/item/editor/EditorRollControl";

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
	].find((candidate) => candidate.textContent === label || candidate.title === label);
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
			onSelectedProgressIndexChange: undefined,
			selectedProgressIndex: undefined,
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
			selectedLineId: undefined,
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

const InputChargesHarness = () => {
	const [input, setInput] = useState<EditorInput>({
		charges: {
			cost: 1,
			from: "self",
		},
		type: "simple",
	});
	return createElement(
		Fragment,
		null,
		createElement(EditorInputCharges, {
			input,
			onChange: setInput,
		}),
		createElement("output", null, JSON.stringify(input)),
	);
};

const ChanceRollHarness = () => {
	const [roll, setRoll] = useState<EditorRoll>({
		chance: 0.4,
		drop: [
			{
				itemId: "item:paper",
				placement: "drop",
				quantity: {
					min: 1,
					max: 1,
				},
				rules: [],
			},
		],
		type: "chance",
	});
	return createElement(
		Fragment,
		null,
		createElement(EditorRollControl, {
			onChange: (next) => {
				if (next !== undefined) setRoll(next);
			},
			value: roll,
		}),
		createElement("output", null, JSON.stringify(roll)),
	);
};

describe("editor item field groups", () => {
	it("adds a second registered artwork layer", async () => {
		const container = await mount(createElement(ArtworkHarness));
		expect(container.textContent).toContain("Composite artwork is disabled");
		await click(container, "Enable composite artwork");

		expect(container.querySelector("output")?.textContent).toContain('"default":["base",""]');
	});

	it("creates the first registered merge entry", async () => {
		const container = await mount(createElement(MergeHarness));
		expect(container.textContent).toContain("Merges are disabled");
		await click(container, "Enable merges");

		expect(container.querySelector("output")?.textContent).toContain('"effect":"keep"');
	});

	it("creates unique deposit lines with only the first authored as default", async () => {
		const container = await mount(createElement(ProductionHarness));
		expect(container.textContent).toContain("Production lines are disabled");
		await click(container, "Enable production lines");
		expect(container.querySelectorAll('[data-ui="EditorFormCard"]')).toHaveLength(5);
		expect(
			container.querySelectorAll(
				'[data-ui="EditorFormSectionDivider"][data-variant="primary"]',
			),
		).toHaveLength(1);
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
		await click(container, "Enable production lines");

		expect(container.querySelector("output")?.textContent).toContain(
			'"id":"line:renamed:default"',
		);
	});

	it("disables an input charge from its compact trailing action", async () => {
		const container = await mount(createElement(InputChargesHarness));
		const disable = container.querySelector<HTMLButtonElement>(
			'[data-ui="EditorInputChargeDisableButton"]',
		);
		if (disable === null) throw new Error("Missing charge disable action.");
		await act(async () => disable.click());

		expect(container.querySelector("output")?.textContent).not.toContain("charges");
		expect(container.textContent).toContain("Charge cost is disabled");
	});

	it("edits chance as a percentage while preserving the engine ratio", async () => {
		const container = await mount(createElement(ChanceRollHarness));
		const input = container.querySelector<HTMLInputElement>('input[type="number"]');
		if (input === null) throw new Error("Missing chance percentage input.");
		expect(input.value).toBe("40");

		const valueSetter = Object.getOwnPropertyDescriptor(
			HTMLInputElement.prototype,
			"value",
		)?.set;
		if (valueSetter === undefined) throw new Error("Expected native input value setter.");
		await act(async () => {
			valueSetter.call(input, "75");
			input.dispatchEvent(
				new Event("input", {
					bubbles: true,
				}),
			);
		});

		expect(container.querySelector("output")?.textContent).toContain('"chance":0.75');
	});
});
