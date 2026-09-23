// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { OutcomeTableSchema } from "~/outcome/schema/OutcomeTableSchema";

vi.mock("~/item-authoring/ui/FormContext", () => ({
	useFormSession: () => ({
		outcomeSetIndex: 1,
		outcomeRollIndex: 2,
		outcomeIndex: 1,
		ruleIndex: 1,
		whenIndex: 1,
	}),
}));
vi.mock("~/authoring-form/ui/EditorItemThumbnail", () => ({
	EditorItemThumbnail: () => null,
	EditorItemSearchThumbnail: () => null,
}));
vi.mock("~/item-authoring/ui/useFormValidationIssues", () => ({
	useFormValidationFocusIndex: () => undefined,
	useFormValidationIssues: () => [],
}));
vi.mock("~/authoring-session/ui/useEditorProject", () => ({
	useEditorProject: () => ({
		config: {
			items: {},
		},
	}),
}));
vi.mock("~/authoring-form/ui/useEditorItemSearchOptions", () => ({
	useEditorItemOptionLabel: () => (id: string, fallback: string) => id || fallback,
	useEditorItemSearchOptions: () => ({
		items: {},
		options: [],
	}),
}));
vi.mock("~/translation/ui/useTranslator", () => ({
	useTranslator: () => ({
		textFn: (text: string) => text,
	}),
}));
vi.mock("~/editor-control/ui/EditorSearchCombobox", () => ({
	EditorSearchCombobox: ({ label, value }: { label: string; value: string }) =>
		createElement(
			"output",
			{
				"data-label": label,
			},
			value,
		),
}));

import { OutcomeControl } from "~/production-authoring/ui/OutcomeControl";
import { RollSetControl } from "~/production-authoring/ui/RollSetControl";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

it("preserves shared rules while replacing fields of the previous outcome kind", async () => {
	const rules = [
		{
			type: "disable",
			when: [
				{
					type: "exists",
					query: {
						distance: "self",
						selector: {
							type: "item",
							itemUid: "permit",
						},
					},
				},
			],
		},
	];
	const value = OutcomeTableSchema.parse({
		set: [
			{
				weight: 1,
				rules: [],
				roll: [
					{
						type: "guaranteed",
						outcome: [
							{
								type: "item",
								itemUid: "ore",
								quantity: {
									min: 2,
									max: 3,
								},
								placement: "random",
								rules,
							},
						],
					},
				],
			},
		],
	});
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	const onChangeFn = vi.fn();
	const renderOutcomeFn = async (outcome: OutcomeTableSchema.Type) =>
		act(async () =>
			root.render(
				<OutcomeControl
					value={outcome}
					onChangeFn={onChangeFn}
				/>,
			),
		);
	const selectKindFn = async (label: string) => {
		const button = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
			(candidate) => candidate.textContent === label,
		);
		if (button === undefined) throw new Error(`Missing ${label} outcome kind.`);
		await act(async () => button.click());
		return onChangeFn.mock.lastCall?.[0] as OutcomeTableSchema.Type;
	};
	try {
		await renderOutcomeFn(value);
		const space = await selectKindFn("Space");
		expect(space.set[0].roll[0].outcome[0]).toEqual({
			type: "space",
			space: 0,
			rules,
		});
		await renderOutcomeFn(space);
		const item = await selectKindFn("Item");
		expect(item.set[0].roll[0].outcome[0]).toMatchObject({
			type: "item",
			rules,
		});
		expect(item.set[0].roll[0].outcome[0]).not.toHaveProperty("space");
	} finally {
		await act(async () => root.unmount());
		container.remove();
	}
});

it.each([
	"guaranteed",
	"chance",
] as const)("opens the exact drop in a %s roll on first form render", async (type) => {
	const drop = (itemUid: string) => ({
		itemUid,
		type: "item" as const,
		quantity: {
			min: 1,
			max: 1,
		},
		placement: "drop",
		rules: [
			{
				type: "enable",
				when: [
					{
						type: "exists",
						query: {
							distance: "far",
							selector: {
								type: "item",
								itemUid: "other",
							},
						},
					},
				],
			},
			{
				type: "enable",
				when: [
					"other",
					"permit",
				].map((itemUid) => ({
					type: "exists",
					query: {
						distance: "far",
						selector: {
							type: "item",
							itemUid,
						},
					},
				})),
			},
		],
	});
	const targetOutcomes = [
		drop("meat"),
		drop("bones"),
	];
	const roll =
		type === "chance"
			? {
					type,
					chance: 0.5,
					outcome: targetOutcomes,
				}
			: {
					type,
					outcome: targetOutcomes,
				};
	const value = OutcomeTableSchema.parse({
		set: Array.from(
			{
				length: 2,
			},
			() => ({
				weight: 1,
				rules: [],
				roll: [
					roll,
					roll,
					roll,
				],
			}),
		),
	});
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	try {
		await act(async () =>
			root.render(
				<OutcomeControl
					value={value}
					onChangeFn={() => {}}
				/>,
			),
		);
		expect(container.querySelector('[data-label="Outcome sets"]')?.textContent).toBe("1");
		expect(container.querySelector('[data-label="Outcome set 2 rolls"]')?.textContent).toBe(
			"2",
		);
		expect(container.querySelector('[data-label="Outcomes"]')?.textContent).toBe("1");
		expect(container.querySelector('[data-label="Item"]')?.textContent).toBe("bones");
		expect(container.querySelector('[data-label="Rules"]')?.textContent).toBe("1");
		expect(container.querySelector('[data-label="Rule 2 conditions"]')?.textContent).toBe("1");
		expect(container.querySelector('[data-label="Selected item"]')?.textContent).toBe("permit");
	} finally {
		await act(async () => root.unmount());
		container.remove();
	}
});

it("focuses and edits a set rule without changing the selected set's drops", async () => {
	const condition = (itemUid: string) => ({
		type: "exists",
		query: {
			distance: "far",
			selector: {
				type: "item",
				itemUid,
			},
		},
	});
	const value = OutcomeTableSchema.parse({
		set: [
			{
				weight: 1,
				rules: [
					{
						type: "enable",
						when: [
							condition("other"),
						],
					},
					{
						type: "disable",
						when: [
							condition("other"),
							condition("permit"),
						],
					},
				],
				roll: [
					{
						type: "guaranteed",
						outcome: [
							{
								itemUid: "ore",
								type: "item",
								quantity: {
									min: 1,
									max: 1,
								},
								placement: "drop",
								rules: [],
							},
						],
					},
				],
			},
		],
	}).set[0];
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	const onChangeFn = vi.fn();
	try {
		await act(async () =>
			root.render(
				<RollSetControl
					index={0}
					showWeight={false}
					value={value}
					initialRuleIndex={1}
					initialWhenIndex={1}
					onChangeFn={onChangeFn}
				/>,
			),
		);
		const rules = container.querySelector('[data-ui="EditorRulesCollection"]');
		expect(rules?.querySelector('[data-label="Set rules"]')?.textContent).toBe("1");
		expect(rules?.querySelector('[data-label="Rule 2 conditions"]')?.textContent).toBe("1");
		expect(rules?.querySelector('[data-label="Selected item"]')?.textContent).toBe("permit");
		await act(async () =>
			rules?.querySelector<HTMLButtonElement>('[data-ui="EditorCollectionRemove"]')?.click(),
		);
		const next = onChangeFn.mock.lastCall?.[0];
		expect(next.rules).toEqual([
			value.rules[0],
		]);
		expect(next.roll).toBe(value.roll);
	} finally {
		await act(async () => root.unmount());
		container.remove();
	}
});

it.each([
	{
		type: "item" as const,
		itemUid: "ore",
		quantity: {
			min: 3,
			max: 7,
		},
		placement: "random" as const,
		rules: [],
	},
	{
		type: "space" as const,
		space: 731,
		rules: [],
	},
])(
	"preserves the complete $type draft when its selected kind is clicked again",
	async (outcome) => {
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		const onChangeFn = vi.fn();
		const value = OutcomeTableSchema.parse({
			set: [
				{
					weight: 1,
					rules: [],
					roll: [
						{
							type: "guaranteed",
							outcome: [
								outcome,
							],
						},
					],
				},
			],
		});
		const before = structuredClone(value);
		try {
			await act(async () =>
				root.render(
					<OutcomeControl
						value={value}
						onChangeFn={onChangeFn}
					/>,
				),
			);
			const selectedKind = Array.from(
				container.querySelectorAll<HTMLButtonElement>("button"),
			).find((button) => button.textContent === (outcome.type === "item" ? "Item" : "Space"));
			if (selectedKind === undefined) throw new Error("Missing selected outcome kind.");
			await act(async () => selectedKind.click());
			expect(onChangeFn).not.toHaveBeenCalled();
			expect(value).toEqual(before);
		} finally {
			await act(async () => root.unmount());
			container.remove();
		}
	},
);
