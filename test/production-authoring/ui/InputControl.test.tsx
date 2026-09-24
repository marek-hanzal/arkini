// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { InputSchema } from "~/production-input/schema/InputSchema";

const state = vi.hoisted(() => ({
	items: {} as Record<string, ItemSchema.Type>,
}));

vi.mock("~/authoring-session/ui/useEditorProject", () => ({
	useEditorProject: () => ({
		config: {
			items: state.items,
		},
	}),
}));

vi.mock("~/authoring-form/ui/EditorItemThumbnail", () => ({
	EditorItemSearchThumbnail: () => null,
}));

import { InputControl } from "~/production-authoring/ui/InputControl";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("~/translation/ui/useTranslator", () => ({
	useTranslator: () => ({
		textFn: (key: string) => key,
	}),
}));

const roots: Array<ReturnType<typeof createRoot>> = [];

beforeEach(() => {
	state.items = {};
});

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
});

const createContainer = () => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	return {
		container,
		root,
	};
};

const renderInput = async (
	root: ReturnType<typeof createRoot>,
	input: InputSchema.Type,
	onChangeFn: (input: InputSchema.Type) => void = () => undefined,
	selfUnitsEnabled = true,
) => {
	await act(async () => {
		root.render(
			<InputControl
				input={input}
				selfUnitsEnabled={selfUnitsEnabled}
				onChangeFn={onChangeFn}
			/>,
		);
	});
};

const changeInput = async (input: HTMLInputElement, value: string) => {
	const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
	if (valueSetter === undefined) throw new Error("Expected native input value setter.");
	await act(async () => {
		valueSetter.call(input, value);
		input.dispatchEvent(
			new Event("input", {
				bubbles: true,
			}),
		);
	});
};

const withoutUnitsUnitsInput = {
	type: "units",
	query: {
		distance: "close",
		selector: {
			type: "item",
			itemUid: "stone-units",
		},
	},
} as const satisfies InputSchema.Type;

const findChoiceControl = (container: Element, label: string) => {
	const control = Array.from(container.querySelectorAll('[data-ui="EditorChoiceControl"]')).find(
		(candidate) => candidate.querySelector("legend")?.textContent === label,
	);
	if (control === undefined) throw new Error(`Expected ${label} choice control.`);
	return control;
};

const createSearchItem = (id: string, spent: boolean) =>
	({
		maxQueueSize: 1,
		ui: "default",
		lines: [],

		uid: id,

		title: id,
		description: id,
		artwork: {
			scale: 0.8,
			default: [
				`artwork:${id}`,
			],
		},
		...(spent
			? {
					units: {
						amount: 1,
					},
				}
			: {}),
	}) satisfies ItemSchema.Type;

describe("InputControl", () => {
	it("keeps material quantity bounds ordered when either bound crosses the other", async () => {
		const { container, root } = createContainer();
		const onChangeFn = vi.fn();
		await renderInput(
			root,
			{
				type: "materials",
				mode: "consume",
				quantity: {
					min: 5,
					max: 10,
				},
				query: {
					distance: "far",
					selector: {
						type: "item",
						itemUid: "stone",
					},
				},
			},
			onChangeFn,
		);
		const bounds = container.querySelectorAll<HTMLInputElement>('input[type="number"]');
		if (bounds.length < 2) throw new Error("Expected material quantity bounds.");

		await changeInput(bounds[0], "12");
		expect(onChangeFn).toHaveBeenLastCalledWith(
			expect.objectContaining({
				quantity: {
					min: 12,
					max: 12,
				},
			}),
		);

		await changeInput(bounds[1], "3");
		expect(onChangeFn).toHaveBeenLastCalledWith(
			expect.objectContaining({
				quantity: {
					min: 3,
					max: 3,
				},
			}),
		);
	});

	it("edits target query reach while keeping Target as the default unit payer", async () => {
		const { container, root } = createContainer();
		const onChangeFn = vi.fn();
		await renderInput(root, withoutUnitsUnitsInput, onChangeFn);

		const unitCost = container.querySelector('[data-ui="EditorInputUnitCost"]');
		if (unitCost === null) throw new Error("Expected Units unit cost controls.");
		const boardDistance = findChoiceControl(unitCost, "Search area");
		const nearClose = boardDistance.querySelector<HTMLButtonElement>(
			'[data-ui-value="near-close"]',
		);
		if (nearClose === null) throw new Error("Expected Near-Close query control.");
		await act(async () => nearClose.click());
		expect(onChangeFn).toHaveBeenLastCalledWith({
			...withoutUnitsUnitsInput,
			units: {
				cost: 1,
				from: "target",
			},
			query: {
				...withoutUnitsUnitsInput.query,
				distance: "near-close",
			},
		});
	});

	it("locks target unit Cost until an item is selected and caps it at that item's units", async () => {
		const payer = {
			...createSearchItem("battery-target", true),
			units: {
				amount: 7,
			},
		} satisfies ItemSchema.Type;
		state.items = {
			[payer.uid]: payer,
		};
		const { container, root } = createContainer();
		const onChangeFn = vi.fn();
		await renderInput(
			root,
			{
				...withoutUnitsUnitsInput,
				units: {
					cost: 99_999,
					from: "target",
				},
				query: {
					...withoutUnitsUnitsInput.query,
					selector: {
						type: "item",
						itemUid: "",
					},
				},
			},
			onChangeFn,
		);

		const cost = container.querySelector<HTMLInputElement>('input[type="number"]');
		const search = container.querySelector<HTMLInputElement>(
			'[data-ui="EditorSearchComboboxInput"]',
		);
		if (cost === null || search === null) throw new Error("Expected target unit controls.");
		expect(cost.disabled).toBe(true);

		await act(async () => search.click());
		const option = document.querySelector<HTMLButtonElement>(
			'[data-ui="EditorSearchComboboxOption"]',
		);
		if (option === null) throw new Error("Expected selectable unit payer.");
		await act(async () => option.click());
		expect(onChangeFn).toHaveBeenLastCalledWith(
			expect.objectContaining({
				units: {
					cost: 7,
					from: "target",
				},
			}),
		);

		await renderInput(
			root,
			{
				...withoutUnitsUnitsInput,
				units: {
					cost: 1,
					from: "target",
				},
				query: {
					...withoutUnitsUnitsInput.query,
					selector: {
						type: "item",
						itemUid: payer.uid,
					},
				},
			},
			onChangeFn,
		);
		const enabledCost = container.querySelector<HTMLInputElement>('input[type="number"]');
		if (enabledCost === null) throw new Error("Expected enabled target unit Cost.");
		expect(enabledCost.disabled).toBe(false);
		expect(enabledCost.max).toBe("7");
		await changeInput(enabledCost, "99999");
		expect(onChangeFn).toHaveBeenLastCalledWith(
			expect.objectContaining({
				units: {
					cost: 7,
					from: "target",
				},
			}),
		);
	});

	it("marks the exact invalid Units control and shows its local error", async () => {
		const { container, root } = createContainer();
		await act(async () => {
			root.render(
				<InputControl
					input={withoutUnitsUnitsInput}
					issues={[
						{
							message: "Choose a target with units.",
							path: [
								"query",
								"selector",
								"itemUid",
							],
						},
					]}
					onChangeFn={() => undefined}
					selfUnitsEnabled
				/>,
			);
		});

		const selectedItem = container.querySelector<HTMLInputElement>(
			'[data-ui="EditorSearchComboboxInput"]',
		);
		expect(selectedItem?.dataset.uiInvalid).toBe("true");
		expect(container.textContent).toContain("Choose a target with units.");
	});

	it("keeps an existing self-paid input editable and flags its disabled owner Units", async () => {
		const { container, root } = createContainer();
		const input: InputSchema.Type = {
			type: "units",
			units: {
				cost: 2,
				from: "self",
			},
			query: {
				distance: "self",
				selector: {
					type: "item",
					itemUid: "owner",
				},
			},
		};
		const onChangeFn = vi.fn();
		await renderInput(root, input, onChangeFn, false);
		expect(container.textContent).toContain("Enable Units on this item before selecting Self.");
		const cost = container.querySelector<HTMLInputElement>('input[type="number"]');
		if (cost === null) throw new Error("Expected existing self unit Cost.");
		await changeInput(cost, "3");
		expect(onChangeFn).toHaveBeenCalledWith({
			...input,
			units: {
				cost: 3,
				from: "self",
			},
		});
		await renderInput(root, input, onChangeFn, true);
		expect(container.textContent).not.toContain(
			"Enable Units on this item before selecting Self.",
		);
	});

	it("offers only items with units to a target-paid Units and flags an existing invalid target", async () => {
		const spent = createSearchItem("battery-target", true);
		const withoutUnits = createSearchItem("plain-target", false);
		state.items = {
			[spent.uid]: spent,
			[withoutUnits.uid]: withoutUnits,
		};
		const { container, root } = createContainer();
		await renderInput(root, {
			...withoutUnitsUnitsInput,
			units: {
				cost: 1,
				from: "target",
			},
			query: {
				...withoutUnitsUnitsInput.query,
				selector: {
					type: "item",
					itemUid: withoutUnits.uid,
				},
			},
		});

		expect(container.querySelector('[data-ui="EditorInfoTooltip"]')).not.toBeNull();
		expect(container.textContent).toContain("Selected target must have Units enabled.");
		const search = container.querySelector<HTMLInputElement>(
			'[data-ui="EditorSearchComboboxInput"]',
		);
		if (search === null) throw new Error("Expected Units target search.");
		await act(async () => search.click());
		const options = Array.from(
			document.querySelectorAll('[data-ui="EditorSearchComboboxOption"]'),
		).map((option) => option.textContent);

		expect(options).toHaveLength(1);
		expect(options[0]).toContain(spent.title);
		expect(options[0]).not.toContain(withoutUnits.title);
	});
});
