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

vi.mock("~/translation/ui/useTranslator", () => ({
	useTranslator: () => ({
		textFn: (key: string) => key,
	}),
}));

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
	it("enables Spend only when the source item has Units", async () => {
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		const onChangeFn = vi.fn();
		const renderField = async (sourceUnitsEnabled: boolean) => {
			await act(async () => {
				root.render(
					<MergeField
						merge={merge}
						onChangeFn={onChangeFn}
						sourceUnitsEnabled={sourceUnitsEnabled}
						targetUnitsEnabled={false}
					/>,
				);
			});
		};

		await renderField(false);
		let units = container.querySelectorAll<HTMLButtonElement>(
			'button[data-ui-value="spend"]',
		)[0];
		if (units === null) throw new Error("Expected Units source action.");
		expect(units.disabled).toBe(true);

		await renderField(true);
		units = container.querySelectorAll<HTMLButtonElement>('button[data-ui-value="spend"]')[0];
		if (units === null) throw new Error("Expected Units source action.");
		expect(units.disabled).toBe(false);
		await act(async () => units.click());
		expect(onChangeFn).toHaveBeenCalledWith({
			...merge,
			action: "spend",
		});
	});

	it("enables Spend only when the selected target item has Units", async () => {
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		const onChangeFn = vi.fn();
		const renderField = async (targetUnitsEnabled: boolean) => {
			await act(async () => {
				root.render(
					<MergeField
						merge={merge}
						onChangeFn={onChangeFn}
						sourceUnitsEnabled={false}
						targetUnitsEnabled={targetUnitsEnabled}
					/>,
				);
			});
		};

		await renderField(false);
		let units = container.querySelectorAll<HTMLButtonElement>(
			'button[data-ui-value="spend"]',
		)[1];
		if (units === undefined) throw new Error("Expected Units target effect.");
		expect(units.disabled).toBe(true);

		await renderField(true);
		units = container.querySelectorAll<HTMLButtonElement>('button[data-ui-value="spend"]')[1];
		if (units === undefined) throw new Error("Expected Units target effect.");
		expect(units.disabled).toBe(false);
		await act(async () => units.click());
		expect(onChangeFn).toHaveBeenCalledWith({
			...merge,
			effect: "spend",
		});
	});
});
