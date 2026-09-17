// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import type { RuleSchema } from "~/production-line/schema/RuleSchema";

vi.mock("~/authoring-session/ui/useEditorProject", () => ({
	useEditorProject: () => ({
		config: {
			items: {},
		},
	}),
}));

vi.mock("~/item-authoring/ui/useFormValidationIssues", () => ({
	useFormValidationFocusIndex: () => undefined,
	useFormValidationIssues: () => [],
}));
vi.mock("~/translation/ui/useTranslator", () => ({
	useTranslator: () => ({
		textFn: (text: string) => text,
	}),
}));
vi.mock("~/translation/ui/Mx", () => ({
	Mx: ({ label }: { label: string }) => createElement("span", null, label),
}));
vi.mock("~/authoring-form/ui/useEditorItemSearchOptions", () => ({
	useEditorItemOptionLabel: () => (itemId: string, fallback: string) => itemId || fallback,
}));
vi.mock("~/production-authoring/ui/SelectorControl", () => ({
	SelectorControl: ({
		onChangeFn,
		value,
	}: {
		readonly onChangeFn: (value: { readonly itemId: string; readonly type: "item" }) => void;
		readonly value: {
			readonly itemId: string;
			readonly type: "item";
		};
	}) =>
		createElement(
			"button",
			{
				"data-selector-item-id": value.itemId,
				type: "button",
				onClick: () =>
					onChangeFn({
						...value,
						itemId: "selected-item",
					}),
			},
			"Item selector",
		),
}));

import { RulesControl } from "~/production-authoring/ui/RulesControl";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

it("reveals and removes each rule and condition level independently", async () => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	const onChangeFn = vi.fn();
	const renderRulesFn = async (rules: RuleSchema.Type[]) =>
		act(async () =>
			root.render(
				<RulesControl
					allowedTypes={[
						"enable",
						"disable",
					]}
					description={null}
					onChangeFn={onChangeFn}
					rules={rules}
					target="line"
				/>,
			),
		);
	const choiceButtonFn = (label: string) =>
		Array.from(
			container.querySelectorAll<HTMLButtonElement>('[data-ui="EditorChoiceControlOption"]'),
		).find((button) => button.textContent?.trim() === label);
	try {
		let rules = [] as RuleSchema.Type[];
		await renderRulesFn(rules);
		expect(
			container.querySelector<HTMLButtonElement>(
				'[data-ui="EditorRulesCollection"] [data-ui="EditorCollectionAdd"]',
			)?.disabled,
		).toBe(false);
		expect(
			container.querySelector<HTMLButtonElement>(
				'[data-ui="EditorRulesCollection"] [data-ui="EditorCollectionRemove"]',
			)?.disabled,
		).toBe(true);

		await act(async () =>
			container
				.querySelector<HTMLButtonElement>(
					'[data-ui="EditorRulesCollection"] [data-ui="EditorCollectionAdd"]',
				)
				?.click(),
		);
		rules = onChangeFn.mock.lastCall?.[0] as RuleSchema.Type[];
		expect(rules).toEqual([
			{
				when: [],
			},
		]);
		await renderRulesFn(rules);
		expect(container.textContent).toContain("Rule type");
		expect(container.textContent).not.toContain("Hint");
		expect(container.querySelector('[data-ui="EditorConditionsCollection"]')).toBeNull();
		expect(
			container.querySelector(
				'[data-ui="EditorChoiceControlOption"][data-ui-selected="true"]',
			),
		).toBeNull();

		await act(async () => choiceButtonFn("Enable")?.click());
		rules = onChangeFn.mock.lastCall?.[0] as RuleSchema.Type[];
		expect(rules[0]).toMatchObject({
			type: "enable",
			when: [],
		});
		await renderRulesFn(rules);
		expect(container.textContent).toContain("Hint");
		expect(
			container.querySelector<HTMLButtonElement>(
				'[data-ui="EditorConditionsCollection"] [data-ui="EditorCollectionAdd"]',
			)?.disabled,
		).toBe(false);
		expect(
			container.querySelector<HTMLButtonElement>(
				'[data-ui="EditorConditionsCollection"] [data-ui="EditorCollectionRemove"]',
			)?.disabled,
		).toBe(true);

		await act(async () =>
			container
				.querySelector<HTMLButtonElement>(
					'[data-ui="EditorConditionsCollection"] [data-ui="EditorCollectionAdd"]',
				)
				?.click(),
		);
		rules = onChangeFn.mock.lastCall?.[0] as RuleSchema.Type[];
		expect(rules[0].when).toEqual([
			{
				query: {
					scope: "any",
					selector: {
						itemId: "",
						type: "item",
					},
				},
			},
		]);
		await renderRulesFn(rules);
		expect(container.textContent).toContain("Condition type");
		expect(container.querySelector("[data-selector-item-id]")).toBeNull();
		expect(container.textContent).not.toContain("Query scope");

		await act(async () => choiceButtonFn("Count range")?.click());
		rules = onChangeFn.mock.lastCall?.[0] as RuleSchema.Type[];
		await renderRulesFn(rules);
		expect(container.querySelector('[data-selector-item-id=""]')).not.toBeNull();
		expect(container.textContent).toContain("Minimum count");
		expect(container.textContent).toContain("Maximum count");
		expect(container.textContent).toContain("Query scope");

		await act(async () =>
			container.querySelector<HTMLButtonElement>("[data-selector-item-id]")?.click(),
		);
		rules = onChangeFn.mock.lastCall?.[0] as RuleSchema.Type[];
		await renderRulesFn(rules);
		await act(async () => choiceButtonFn("Exact count")?.click());
		rules = onChangeFn.mock.lastCall?.[0] as RuleSchema.Type[];
		expect(rules[0].when[0]).toMatchObject({
			type: "count",
			count: 1,
			query: {
				selector: {
					itemId: "selected-item",
				},
			},
		});
		await renderRulesFn(rules);

		await act(async () =>
			container
				.querySelector<HTMLButtonElement>(
					'[data-ui="EditorConditionsCollection"] [data-ui="EditorCollectionRemove"]',
				)
				?.click(),
		);
		rules = onChangeFn.mock.lastCall?.[0] as RuleSchema.Type[];
		expect(rules[0]).toMatchObject({
			type: "enable",
			when: [],
		});
		await renderRulesFn(rules);
		expect(container.textContent).toContain("Rule type");
		expect(container.querySelector('[data-ui="EditorConditionsCollection"]')).not.toBeNull();

		await act(async () =>
			container
				.querySelector<HTMLButtonElement>(
					'[data-ui="EditorRulesCollection"] [data-ui="EditorCollectionRemove"]',
				)
				?.click(),
		);
		rules = onChangeFn.mock.lastCall?.[0] as RuleSchema.Type[];
		expect(rules).toEqual([]);
		await renderRulesFn(rules);
		expect(container.querySelector('[data-ui="EditorRulesCollection"]')).not.toBeNull();
	} finally {
		await act(async () => root.unmount());
		container.remove();
	}
});

it("duplicates the selected root rule with all of its conditions", async () => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	const onChangeFn = vi.fn();
	const rules: RuleSchema.Type[] = [
		{
			type: "enable",
			hint: "Needs ore",
			when: [
				{
					type: "count",
					count: 2,
					query: {
						scope: "inventory",
						selector: {
							type: "item",
							itemId: "ore",
						},
					},
				},
			],
		},
	];
	try {
		await act(async () =>
			root.render(
				<RulesControl
					allowedTypes={[
						"enable",
						"disable",
					]}
					description={null}
					onChangeFn={onChangeFn}
					rules={rules}
					target="line"
				/>,
			),
		);
		await act(async () =>
			container
				.querySelector<HTMLButtonElement>(
					'[data-ui="EditorRulesCollection"] [data-ui="EditorCollectionDuplicate"]',
				)
				?.click(),
		);
		const next = onChangeFn.mock.lastCall?.[0] as RuleSchema.Type[];
		expect(next).toEqual([
			rules[0],
			rules[0],
		]);
		expect(next[1]).not.toBe(rules[0]);
		expect(next[1].when).not.toBe(rules[0].when);
	} finally {
		await act(async () => root.unmount());
		container.remove();
	}
});
