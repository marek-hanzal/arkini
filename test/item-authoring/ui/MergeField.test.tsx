// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { MergeSchema } from "~/item-merge/schema/MergeSchema";

vi.mock("~/authoring-session/ui/useEditorProject", () => ({
	useEditorProject: () => ({
		config: {
			templates: [
				{
					uid: "interior",
					title: "Interior",
					width: 2,
					height: 2,
					board: [],
				},
			],
		},
	}),
}));

vi.mock("~/template-authoring/ui/TemplateSelector", () => ({
	TemplateSelector: ({ onChangeFn }: { onChangeFn: (uid: string) => void }) => (
		<button
			data-template="other"
			onClick={() => onChangeFn("other")}
		>
			Select other
		</button>
	),
}));

vi.mock("~/item-authoring/ui/useFormValidationIssues", () => ({
	useFormValidationIssues: () => [],
}));

vi.mock("~/production-authoring/ui/SelectorControl", () => ({
	SelectorControl: () => createElement("span"),
}));

vi.mock("~/authoring-form/ui/EditorItemAutocompleteField", () => ({
	EditorItemReferenceControl: () => createElement("span"),
}));

vi.mock("~/production-authoring/ui/OutcomeControl", () => ({
	OutcomeControl: () => createElement("span"),
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
		itemUid: "target",
		type: "item",
	},
} satisfies MergeSchema.Type;

describe("MergeField", () => {
	it("selects an instance-owned destination and changes its exact template without losing receiver effects", async () => {
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		const onChangeFn = vi.fn();
		const transport = {
			action: "space",
			effect: "replace",
			result: "replacement",
			space: 17,
		} satisfies MergeSchema.Type;
		const renderFn = async (value: MergeSchema.Type) => {
			await act(async () =>
				root.render(
					<MergeField
						merge={value}
						onChangeFn={onChangeFn}
						sourceUnitsEnabled={false}
						targetUnitsEnabled={false}
					/>,
				),
			);
		};
		await renderFn(transport);
		await act(async () =>
			container.querySelector<HTMLButtonElement>('button[data-ui-value="space"]')!.click(),
		);
		await act(async () =>
			document
				.querySelector<HTMLButtonElement>(
					'button[data-ui="ActionMenuOption"][data-ui-id="generated"]',
				)!
				.click(),
		);
		const generated = {
			...transport,
			space: {
				type: "generated" as const,
				templateUid: "interior",
			},
		};
		expect(onChangeFn).toHaveBeenLastCalledWith(generated);
		await renderFn(generated);
		await act(async () =>
			container.querySelector<HTMLButtonElement>('button[data-template="other"]')!.click(),
		);
		expect(onChangeFn).toHaveBeenLastCalledWith({
			...generated,
			space: {
				type: "generated",
				templateUid: "other",
			},
		});
	});

	it("preserves transport destination on reselect and target replacement while changing action", async () => {
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		const onChangeFn = vi.fn();
		const transport = {
			action: "space",
			space: 17,
			effect: "replace",
			result: "replacement",
		} satisfies MergeSchema.Type;
		await act(async () =>
			root.render(
				<MergeField
					merge={transport}
					onChangeFn={onChangeFn}
					sourceUnitsEnabled={false}
					targetUnitsEnabled={false}
				/>,
			),
		);
		await act(async () =>
			container.querySelector<HTMLButtonElement>('button[data-ui-value="space"]')!.click(),
		);
		await act(async () =>
			document
				.querySelector<HTMLButtonElement>(
					'button[data-ui="ActionMenuOption"][data-ui-id="exact"]',
				)!
				.click(),
		);
		expect(onChangeFn).not.toHaveBeenCalled();
		await act(async () =>
			container.querySelector<HTMLButtonElement>('button[data-ui-value="consume"]')!.click(),
		);
		expect(onChangeFn).toHaveBeenCalledWith({
			action: "consume",
			target: {
				type: "item",
				itemUid: "",
			},
			effect: "replace",
			result: "replacement",
			outcome: undefined,
		});
	});

	it("selects Previous Space without retaining an exact space number", async () => {
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		const onChangeFn = vi.fn();
		const transport = {
			action: "space",
			space: 17,
			effect: "keep",
		} satisfies MergeSchema.Type;
		await act(async () =>
			root.render(
				<MergeField
					merge={transport}
					onChangeFn={onChangeFn}
					sourceUnitsEnabled={false}
					targetUnitsEnabled={false}
				/>,
			),
		);
		await act(async () =>
			container.querySelector<HTMLButtonElement>('button[data-ui-value="space"]')!.click(),
		);
		await act(async () =>
			document
				.querySelector<HTMLButtonElement>(
					'button[data-ui="ActionMenuOption"][data-ui-id="previous"]',
				)!
				.click(),
		);
		expect(onChangeFn).toHaveBeenCalledWith({
			...transport,
			space: "previous",
		});
	});

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
