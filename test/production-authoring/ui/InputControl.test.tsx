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
				ownerItemId="owner"
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
		scope: "board",
		distance: "close",
		selector: {
			type: "item",
			itemId: "stone-units",
		},
	},
} as const satisfies InputSchema.Type;

const readChoiceValues = (control: Element) =>
	Array.from(control.querySelectorAll<HTMLButtonElement>("button[data-ui-value]")).map(
		(button) => button.dataset.uiValue,
	);

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
		lines: [],

		uid: `uid:${id}`,
		id,

		title: id,
		description: id,
		asset: {
			scale: 0.8,
			default: [
				`asset:${id}`,
			],
		},
		scope: "any",
		maxStackSize: 1,
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
				selector: {
					type: "item",
					itemId: "stone",
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

	it("shows unit authoring only for Units inputs", async () => {
		const { container, root } = createContainer();

		await renderInput(root, {
			type: "simple",
			units: {
				cost: 1,
				from: "self",
			},
		});
		expect(container.querySelector('[data-ui="EditorInputUnitCost"]')).toBeNull();

		await renderInput(root, {
			type: "materials",
			units: {
				cost: 1,
				from: "self",
			},
			mode: "consume",
			quantity: {
				min: 1,
				max: 1,
			},
			selector: {
				type: "item",
				itemId: "stone",
			},
		});
		expect(container.querySelector('[data-ui="EditorInputUnitCost"]')).toBeNull();

		await renderInput(root, withoutUnitsUnitsInput);
		expect(container.querySelector('[data-ui="EditorInputUnitCost"]')).not.toBeNull();
	});

	it("renders Units unit controls with Target as the direct default", async () => {
		const { container, root } = createContainer();
		await renderInput(root, withoutUnitsUnitsInput);

		const unitCost = container.querySelector('[data-ui="EditorInputUnitCost"]');
		if (unitCost === null) throw new Error("Expected Units unit cost controls.");
		const inputType = findChoiceControl(container, "Input type");
		const paidBy = findChoiceControl(container, "Paid by");
		const boardDistance = findChoiceControl(unitCost, "Board distance");

		expect(inputType.parentElement).toBe(paidBy.parentElement);
		expect(unitCost.contains(paidBy)).toBe(false);
		expect(readChoiceValues(paidBy)).toEqual([
			"target",
			"self",
		]);
		expect(readChoiceValues(boardDistance)).toEqual([
			"self",
			"close",
			"near",
			"far",
		]);
		expect(
			paidBy.querySelector('[data-ui-value="target"]')?.getAttribute("data-ui-selected"),
		).toBe("true");
		expect(unitCost.querySelector('[data-ui="EditorSearchComboboxInput"]')).not.toBeNull();
		expect(unitCost.querySelector<HTMLInputElement>('input[type="number"]')?.value).toBe("1");
	});

	it("locks target unit Cost until an item is selected and caps it at that item's units", async () => {
		const payer = {
			...createSearchItem("battery-target", true),
			units: {
				amount: 7,
			},
		} satisfies ItemSchema.Type;
		state.items = {
			[payer.id]: payer,
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
						itemId: "",
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
						itemId: payer.id,
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

	it("renders only Cost for a self-paid Units", async () => {
		const { container, root } = createContainer();
		await renderInput(root, {
			...withoutUnitsUnitsInput,
			units: {
				cost: 2,
				from: "self",
			},
		});

		const unitCost = container.querySelector('[data-ui="EditorInputUnitCost"]');
		if (unitCost === null) throw new Error("Expected Units unit cost controls.");
		const paidBy = findChoiceControl(container, "Paid by");
		const self = paidBy.querySelector<HTMLButtonElement>('[data-ui-value="self"]');
		if (self === null) throw new Error("Expected Self unit source option.");

		expect(self.disabled).toBe(false);
		expect(self.getAttribute("data-ui-selected")).toBe("true");
		expect(unitCost.querySelector('[data-ui="EditorSearchComboboxInput"]')).toBeNull();
		expect(unitCost.querySelector('[data-ui="EditorChoiceControl"]')).toBeNull();
		expect(unitCost.querySelector<HTMLInputElement>('input[type="number"]')?.value).toBe("2");
	});

	it("binds a self-paid Units to the owning item instead of a hidden empty target", async () => {
		const { container, root } = createContainer();
		const onChangeFn = vi.fn();
		await renderInput(root, withoutUnitsUnitsInput, onChangeFn);

		const self = findChoiceControl(container, "Paid by").querySelector<HTMLButtonElement>(
			'[data-ui-value="self"]',
		);
		if (self === null) throw new Error("Expected Self unit source option.");
		await act(async () => self.click());

		expect(onChangeFn).toHaveBeenCalledWith({
			...withoutUnitsUnitsInput,
			units: {
				cost: 1,
				from: "self",
			},
			query: {
				scope: "board",
				distance: "self",
				selector: {
					type: "item",
					itemId: "owner",
				},
			},
		});
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
								"itemId",
							],
						},
					]}
					onChangeFn={() => undefined}
					ownerItemId="owner"
					selfUnitsEnabled
				/>,
			);
		});

		const selectedItem = container.querySelector<HTMLInputElement>(
			'[data-ui="EditorSearchComboboxInput"]',
		);
		expect(selectedItem?.dataset.uiInvalid).toBe("true");
		expect(container.textContent).toContain("Choose a target with units.");
		expect(findChoiceControl(container, "Paid by").getAttribute("data-ui-invalid")).toBe(
			"false",
		);
	});

	it("disables Self when the owning item has no Units", async () => {
		const { container, root } = createContainer();
		await renderInput(root, withoutUnitsUnitsInput, () => undefined, false);

		const paidBy = findChoiceControl(container, "Paid by");
		const self = paidBy.querySelector<HTMLButtonElement>('[data-ui-value="self"]');
		if (self === null) throw new Error("Expected Self unit source option.");

		expect(self.disabled).toBe(true);
		expect(self.dataset.uiDisabled).toBe("true");
	});

	it("creates a new Units input with a Target unit cost", async () => {
		const { container, root } = createContainer();
		const onChangeFn = vi.fn();
		await renderInput(
			root,
			{
				type: "simple",
			},
			onChangeFn,
		);

		const unitsButton = container.querySelector<HTMLButtonElement>(
			'button[data-ui-value="units"]',
		);
		if (unitsButton === null) throw new Error("Expected Units input type option.");
		await act(async () => unitsButton.click());

		expect(onChangeFn).toHaveBeenCalledWith({
			type: "units",
			units: {
				cost: 1,
				from: "target",
			},
			query: {
				scope: "board",
				distance: "close",
				selector: {
					type: "item",
					itemId: "",
				},
			},
		});
	});

	it("offers only items with units to a target-paid Units and flags an existing invalid target", async () => {
		const spent = createSearchItem("battery-target", true);
		const withoutUnits = createSearchItem("plain-target", false);
		state.items = {
			[spent.id]: spent,
			[withoutUnits.id]: withoutUnits,
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
					itemId: withoutUnits.id,
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
