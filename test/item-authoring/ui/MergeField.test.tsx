// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { MergeSchema } from "~/item-merge/schema/MergeSchema";

vi.mock("~/item-authoring/ui/useFormValidationIssues", () => ({
	useFormValidationIssues: () => [],
}));

vi.mock("~/production-authoring/ui/SelectorControl", () => ({
	SelectorControl: () => createElement("span"),
}));

vi.mock("~/authoring-form/ui/EditorItemAutocompleteField", () => ({
	EditorItemReferenceControl: () => createElement("span"),
}));

vi.mock("~/production-authoring/ui/OptionalOutputControl", () => ({
	OptionalOutputControl: () => createElement("span"),
}));

import { MergeField } from "~/item-authoring/ui/MergeField";

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

const merge = {
	action: "use",
	effect: "keep",
	target: {
		itemId: "target",
		type: "item",
	},
} satisfies MergeSchema.Type;

describe("MergeField", () => {
	it("enables Deposit only when the source item has Charges", async () => {
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		const onChangeFn = vi.fn();
		const renderField = async (sourceChargesEnabled: boolean) => {
			await act(async () => {
				root.render(
					<MergeField
						merge={merge}
						onChangeFn={onChangeFn}
						sourceChargesEnabled={sourceChargesEnabled}
					/>,
				);
			});
		};

		await renderField(false);
		let deposit = container.querySelector<HTMLButtonElement>('button[data-ui-value="deposit"]');
		if (deposit === null) throw new Error("Expected Deposit source action.");
		expect(deposit.disabled).toBe(true);

		await renderField(true);
		deposit = container.querySelector<HTMLButtonElement>('button[data-ui-value="deposit"]');
		if (deposit === null) throw new Error("Expected Deposit source action.");
		expect(deposit.disabled).toBe(false);
		await act(async () => deposit.click());
		expect(onChangeFn).toHaveBeenCalledWith({
			...merge,
			action: "deposit",
		});
	});
});
