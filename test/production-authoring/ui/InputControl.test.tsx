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
	selfChargesEnabled = true,
) => {
	await act(async () => {
		root.render(
			<InputControl
				input={input}
				ownerItemId="owner"
				selfChargesEnabled={selfChargesEnabled}
				onChangeFn={onChangeFn}
			/>,
		);
	});
};

const unchargedDepositInput = {
	type: "deposit",
	query: {
		scope: "board",
		distance: "close",
		selector: {
			type: "item",
			itemId: "stone-deposit",
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

const createSearchItem = (id: string, charged: boolean) =>
	({
		uid: `uid:${id}`,
		id,
		type: "simple",
		title: id,
		description: id,
		asset: {
			default: [
				`asset:${id}`,
			],
		},
		scope: "any",
		maxStackSize: 1,
		...(charged
			? {
					charges: {
						amount: 1,
					},
				}
			: {}),
	}) satisfies ItemSchema.Type;

describe("InputControl", () => {
	it("shows charge authoring only for Deposit inputs", async () => {
		const { container, root } = createContainer();

		await renderInput(root, {
			type: "simple",
			charges: {
				cost: 1,
				from: "self",
			},
		});
		expect(container.querySelector('[data-ui="EditorInputChargeCost"]')).toBeNull();

		await renderInput(root, {
			type: "materials",
			capacity: 0,
			charges: {
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
		expect(container.querySelector('[data-ui="EditorInputChargeCost"]')).toBeNull();

		await renderInput(root, unchargedDepositInput);
		expect(container.querySelector('[data-ui="EditorInputChargeCost"]')).not.toBeNull();
	});

	it("renders Deposit charge controls with Target as the direct default", async () => {
		const { container, root } = createContainer();
		await renderInput(root, unchargedDepositInput);

		const chargeCost = container.querySelector('[data-ui="EditorInputChargeCost"]');
		if (chargeCost === null) throw new Error("Expected Deposit charge cost controls.");
		const inputType = findChoiceControl(container, "Input type");
		const paidBy = findChoiceControl(container, "Paid by");
		const boardDistance = findChoiceControl(chargeCost, "Board distance");

		expect(inputType.parentElement).toBe(paidBy.parentElement);
		expect(chargeCost.contains(paidBy)).toBe(false);
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
		expect(chargeCost.querySelector('[data-ui="EditorSearchComboboxInput"]')).not.toBeNull();
		expect(chargeCost.querySelector<HTMLInputElement>('input[type="number"]')?.value).toBe("1");
	});

	it("renders only Cost for a self-paid Deposit", async () => {
		const { container, root } = createContainer();
		await renderInput(root, {
			...unchargedDepositInput,
			charges: {
				cost: 2,
				from: "self",
			},
		});

		const chargeCost = container.querySelector('[data-ui="EditorInputChargeCost"]');
		if (chargeCost === null) throw new Error("Expected Deposit charge cost controls.");
		const paidBy = findChoiceControl(container, "Paid by");
		const self = paidBy.querySelector<HTMLButtonElement>('[data-ui-value="self"]');
		if (self === null) throw new Error("Expected Self charge source option.");

		expect(self.disabled).toBe(false);
		expect(self.getAttribute("data-ui-selected")).toBe("true");
		expect(chargeCost.querySelector('[data-ui="EditorSearchComboboxInput"]')).toBeNull();
		expect(chargeCost.querySelector('[data-ui="EditorChoiceControl"]')).toBeNull();
		expect(chargeCost.querySelector<HTMLInputElement>('input[type="number"]')?.value).toBe("2");
	});

	it("binds a self-paid Deposit to the owning item instead of a hidden empty target", async () => {
		const { container, root } = createContainer();
		const onChangeFn = vi.fn();
		await renderInput(root, unchargedDepositInput, onChangeFn);

		const self = findChoiceControl(container, "Paid by").querySelector<HTMLButtonElement>(
			'[data-ui-value="self"]',
		);
		if (self === null) throw new Error("Expected Self charge source option.");
		await act(async () => self.click());

		expect(onChangeFn).toHaveBeenCalledWith({
			...unchargedDepositInput,
			charges: {
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

	it("marks the exact invalid Deposit control and shows its local error", async () => {
		const { container, root } = createContainer();
		await act(async () => {
			root.render(
				<InputControl
					input={unchargedDepositInput}
					issues={[
						{
							message: "Choose a charged target.",
							path: [
								"query",
								"selector",
								"itemId",
							],
						},
					]}
					onChangeFn={() => undefined}
					ownerItemId="owner"
					selfChargesEnabled
				/>,
			);
		});

		const selectedItem = container.querySelector<HTMLInputElement>(
			'[data-ui="EditorSearchComboboxInput"]',
		);
		expect(selectedItem?.dataset.uiInvalid).toBe("true");
		expect(container.textContent).toContain("Choose a charged target.");
		expect(findChoiceControl(container, "Paid by").getAttribute("data-ui-invalid")).toBe(
			"false",
		);
	});

	it("disables Self when the owning item has no Charges", async () => {
		const { container, root } = createContainer();
		await renderInput(root, unchargedDepositInput, () => undefined, false);

		const paidBy = findChoiceControl(container, "Paid by");
		const self = paidBy.querySelector<HTMLButtonElement>('[data-ui-value="self"]');
		if (self === null) throw new Error("Expected Self charge source option.");

		expect(self.disabled).toBe(true);
		expect(self.dataset.uiDisabled).toBe("true");
	});

	it("creates a new Deposit input with a Target charge cost", async () => {
		const { container, root } = createContainer();
		const onChangeFn = vi.fn();
		await renderInput(
			root,
			{
				type: "simple",
			},
			onChangeFn,
		);

		const depositButton = container.querySelector<HTMLButtonElement>(
			'button[data-ui-value="deposit"]',
		);
		if (depositButton === null) throw new Error("Expected Deposit input type option.");
		await act(async () => depositButton.click());

		expect(onChangeFn).toHaveBeenCalledWith({
			type: "deposit",
			charges: {
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

	it("offers only charged items to a target-paid Deposit and flags an existing invalid target", async () => {
		const charged = createSearchItem("battery-target", true);
		const uncharged = createSearchItem("plain-target", false);
		state.items = {
			[charged.id]: charged,
			[uncharged.id]: uncharged,
		};
		const { container, root } = createContainer();
		await renderInput(root, {
			...unchargedDepositInput,
			charges: {
				cost: 1,
				from: "target",
			},
			query: {
				...unchargedDepositInput.query,
				selector: {
					type: "item",
					itemId: uncharged.id,
				},
			},
		});

		expect(container.querySelector('[data-ui="EditorInfoTooltip"]')).not.toBeNull();
		expect(container.textContent).toContain("Selected target must have Charges enabled.");
		const search = container.querySelector<HTMLInputElement>(
			'[data-ui="EditorSearchComboboxInput"]',
		);
		if (search === null) throw new Error("Expected Deposit target search.");
		await act(async () => search.click());
		const options = Array.from(
			document.querySelectorAll('[data-ui="EditorSearchComboboxOption"]'),
		).map((option) => option.textContent);

		expect(options).toHaveLength(1);
		expect(options[0]).toContain(charged.title);
		expect(options[0]).not.toContain(uncharged.title);
	});
});
