// @vitest-environment jsdom

import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { RuleSchema } from "~/production-line/schema/RuleSchema";
import { DropRuleSchema } from "~/production-output/schema/DropRuleSchema";
import { RulesControl } from "~/production-authoring/ui/RulesControl";
import { TranslationTestProvider } from "~test/support/TranslationTestProvider";
import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";

vi.mock("~/item-authoring/ui/useFormValidationIssues", () => ({
	useFormValidationFocusIndex: () => undefined,
	useFormValidationIssues: () => [],
}));
vi.mock("~/authoring-session/ui/useEditorProject", () => ({
	useEditorProject: () => ({
		config: {
			items,
		},
	}),
}));
vi.mock("~/authoring-form/ui/EditorItemThumbnail", () => ({
	EditorItemThumbnail: () => null,
	EditorItemSearchThumbnail: ({ item }: { readonly item?: ItemSchema.Type }) => (
		<span data-picker-item-id={item?.id} />
	),
}));

const item = editorTestPayload.config.items.water!;
const items: Record<string, ItemSchema.Type> = {
	uncapped: {
		...item,
		uid: "uncapped",
		id: "uncapped",
		title: "Uncapped",
	},
	limited: {
		...item,
		uid: "limited",
		id: "limited",
		title: "Limited",
		maxCount: 3,
	},
	unique: {
		...item,
		uid: "unique",
		id: "unique",
		title: "Unique",
		maxCount: 1,
	},
};

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

it.each([
	"line",
	"drop",
] as const)(
	"admits only capped item references when authoring a %s Limit condition",
	async (target) => {
		const host = document.createElement("div");
		document.body.append(host);
		const root = createRoot(host);
		let authored: RuleSchema.Type[] = [];
		const Form = () => {
			const [rules, setRulesFn] = useState<RuleSchema.Type[]>([
				{
					type: "disable",
					when: [
						{
							type: "count",
							count: 4,
							query: {
								scope: "inventory",
								selector: {
									type: "item",
									itemId: "uncapped",
								},
							},
						},
					],
				},
			]);
			authored = rules;
			return (
				<RulesControl
					allowedTypes={[
						"enable",
						"disable",
					]}
					description={null}
					initialRuleIndex={0}
					initialWhenIndex={0}
					onChangeFn={setRulesFn}
					rules={rules}
					target={target}
				/>
			);
		};
		const chooseConditionFn = async (label: string) => {
			const button = Array.from(
				host.querySelectorAll<HTMLButtonElement>('[data-ui="EditorChoiceControlOption"]'),
			).find((candidate) => candidate.textContent?.trim() === label);
			if (button === undefined) throw new Error(`Missing condition choice ${label}.`);
			await act(async () => button.click());
		};
		const pickerOptionsFn = () =>
			Array.from(
				document.querySelectorAll<HTMLButtonElement>(
					'[data-ui="EditorSearchComboboxOption"]',
				),
			);
		try {
			await act(async () =>
				root.render(
					<TranslationTestProvider>
						<Form />
					</TranslationTestProvider>,
				),
			);
			await chooseConditionFn("Limit");
			expect(authored[0].when).toEqual([
				{
					type: "limit",
					itemId: "",
				},
			]);
			const picker = Array.from(
				host.querySelectorAll<HTMLInputElement>('[data-ui="EditorSearchComboboxInput"]'),
			).at(-1);
			if (picker === undefined) throw new Error("Missing item picker.");
			await act(async () => picker.click());
			await vi.waitFor(() =>
				expect(
					pickerOptionsFn().map(
						(option) =>
							option.querySelector<HTMLElement>("[data-picker-item-id]")?.dataset
								.pickerItemId,
					),
				).toEqual([
					"limited",
					"unique",
				]),
			);
			const limitedOption = pickerOptionsFn().find(
				(option) => option.querySelector('[data-picker-item-id="limited"]') !== null,
			);
			if (limitedOption === undefined) throw new Error("Missing capped item option.");
			await act(async () => limitedOption.click());
			const expected = {
				type: "disable",
				when: [
					{
						type: "limit",
						itemId: "limited",
					},
				],
			};
			// The UI must emit the strict persistence shape, without stale query/count fields.
			expect(JSON.parse(JSON.stringify(authored[0]))).toEqual(expected);
			expect((target === "line" ? RuleSchema : DropRuleSchema).parse(authored[0])).toEqual(
				expected,
			);
			await chooseConditionFn("Exists");
			expect(authored[0].when).toEqual([
				{
					type: "exists",
					query: {
						scope: "any",
						selector: {
							type: "item",
							itemId: "limited",
						},
					},
				},
			]);
			await chooseConditionFn("Limit");
			expect(authored[0].when).toEqual([
				{
					type: "limit",
					itemId: "limited",
				},
			]);
		} finally {
			await act(async () => root.unmount());
			host.remove();
		}
	},
);
