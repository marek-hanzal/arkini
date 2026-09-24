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
	useEditorItemOptionLabel: () => (itemUid: string, fallback: string) => itemUid || fallback,
}));
vi.mock("~/production-authoring/ui/SelectorControl", () => ({
	SelectorControl: () => null,
}));

import { RulesControl } from "~/production-authoring/ui/RulesControl";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

it("creates only allowed rule kinds and typed conditions from the collection menus", async () => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	const onChangeFn = vi.fn();
	const renderFn = async (rules: RuleSchema.Type[]) =>
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
	const selectOptionFn = async (id: string) => {
		const option = document.querySelector<HTMLButtonElement>(
			`[data-ui="ActionMenuOption"][data-ui-id="${id}"]`,
		);
		if (option === null) throw new Error(`Missing ${id} menu option.`);
		await act(async () => option.click());
	};
	try {
		await renderFn([]);
		await act(async () =>
			container
				.querySelector<HTMLButtonElement>(
					'[data-ui="EditorRulesCollection"] [data-ui="EditorCollectionAdd"]',
				)
				?.click(),
		);
		expect(
			document.querySelector('[data-ui="ActionMenuOption"][data-ui-id="show"]'),
		).toBeNull();
		await selectOptionFn("disable");
		const rules = onChangeFn.mock.lastCall?.[0] as RuleSchema.Type[];
		expect(rules).toEqual([
			{
				type: "disable",
				when: [],
			},
		]);
		await renderFn(rules);
		await act(async () =>
			container
				.querySelector<HTMLButtonElement>(
					'[data-ui="EditorConditionsCollection"] [data-ui="EditorCollectionAdd"]',
				)
				?.click(),
		);
		await selectOptionFn("count");
		expect(onChangeFn.mock.lastCall?.[0]).toEqual([
			{
				type: "disable",
				when: [
					{
						type: "count",
						count: 1,
						query: {
							distance: "far",
							selector: {
								type: "item",
								itemUid: "",
							},
						},
					},
				],
			},
		]);
	} finally {
		await act(async () => root.unmount());
		container.remove();
	}
});
