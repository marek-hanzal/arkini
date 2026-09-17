// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { OutputSchema } from "~/production-output/schema/OutputSchema";

vi.mock("~/item-authoring/ui/FormContext", () => ({
	useFormSession: () => ({
		outputSetIndex: 1,
		outputRollIndex: 2,
		outputDropIndex: 1,
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

import { OutputControl } from "~/production-authoring/ui/OutputControl";
import { RollSetControl } from "~/production-authoring/ui/RollSetControl";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

it("keeps empty output-set navigation visible and creates the first set through add", async () => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	const onChangeFn = vi.fn();
	try {
		await act(async () =>
			root.render(
				<OutputControl
					value={undefined}
					onChangeFn={onChangeFn}
				/>,
			),
		);
		const add = container.querySelector<HTMLButtonElement>(
			'[data-ui="EditorOutputSetsCollection"] [data-ui="EditorCollectionAdd"]',
		);
		const remove = container.querySelector<HTMLButtonElement>(
			'[data-ui="EditorOutputSetsCollection"] [data-ui="EditorCollectionRemove"]',
		);
		expect(add?.disabled).toBe(false);
		expect(remove?.disabled).toBe(true);

		await act(async () => add?.click());
		expect(onChangeFn).toHaveBeenCalledWith({
			set: [
				expect.objectContaining({
					weight: 1,
					rules: [],
					roll: [],
				}),
			],
		});
	} finally {
		await act(async () => root.unmount());
		container.remove();
	}
});

it("duplicates the selected root output set with its complete roll tree", async () => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	const onChangeFn = vi.fn();
	const value = OutputSchema.parse({
		set: [
			{
				weight: 3,
				rules: [],
				roll: [
					{
						type: "guaranteed",
						drop: [
							{
								itemId: "ore",
								placement: "drop",
								quantity: {
									min: 2,
									max: 2,
								},
								rules: [],
							},
						],
					},
				],
			},
		],
	});
	try {
		await act(async () =>
			root.render(
				<OutputControl
					value={value}
					onChangeFn={onChangeFn}
				/>,
			),
		);
		await act(async () =>
			container
				.querySelector<HTMLButtonElement>(
					'[data-ui="EditorOutputSetsCollection"] [data-ui="EditorCollectionDuplicate"]',
				)
				?.click(),
		);
		const next = onChangeFn.mock.lastCall?.[0] as OutputSchema.Type;
		expect(next.set).toEqual([
			value.set[0],
			value.set[0],
		]);
		expect(next.set[1]).not.toBe(value.set[0]);
		expect(next.set[1].roll).not.toBe(value.set[0].roll);
	} finally {
		await act(async () => root.unmount());
		container.remove();
	}
});

it("duplicates complete rolls and drops immediately after their source", async () => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	const onChangeFn = vi.fn();
	const renderOutputFn = async (value: OutputSchema.Type) =>
		act(async () =>
			root.render(
				<OutputControl
					value={value}
					onChangeFn={onChangeFn}
				/>,
			),
		);
	let value = OutputSchema.parse({
		set: [
			{
				weight: 1,
				rules: [],
				roll: [
					{
						type: "guaranteed",
						drop: [
							{
								itemId: "ore",
								placement: "drop",
								quantity: {
									min: 2,
									max: 3,
								},
								rules: [],
							},
						],
					},
				],
			},
		],
	});
	try {
		await renderOutputFn(value);
		await act(async () =>
			container
				.querySelector<HTMLButtonElement>(
					'[data-ui="EditorRollsCollection"] [data-ui="EditorCollectionDuplicate"]',
				)
				?.click(),
		);
		value = onChangeFn.mock.lastCall?.[0] as OutputSchema.Type;
		expect(value.set[0].roll).toHaveLength(2);
		expect(value.set[0].roll[1]).toEqual(value.set[0].roll[0]);
		expect(value.set[0].roll[1]).not.toBe(value.set[0].roll[0]);
		await renderOutputFn(value);

		await act(async () =>
			container
				.querySelector<HTMLButtonElement>(
					'[data-ui="EditorDropsCollection"] [data-ui="EditorCollectionDuplicate"]',
				)
				?.click(),
		);
		value = onChangeFn.mock.lastCall?.[0] as OutputSchema.Type;
		const duplicatedRoll = value.set[0].roll[1];
		if (duplicatedRoll.type !== "guaranteed")
			throw new Error("Expected duplicated guaranteed roll.");
		expect(duplicatedRoll.drop).toHaveLength(2);
		expect(duplicatedRoll.drop[1]).toEqual(duplicatedRoll.drop[0]);
		expect(duplicatedRoll.drop[1]).not.toBe(duplicatedRoll.drop[0]);
		expect(duplicatedRoll.drop[1].quantity).not.toBe(duplicatedRoll.drop[0].quantity);
	} finally {
		await act(async () => root.unmount());
		container.remove();
	}
});

it("reveals roll type and drops only after each deliberate authoring step", async () => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	const onChangeFn = vi.fn();
	const renderOutputFn = async (value: OutputSchema.Type) =>
		act(async () =>
			root.render(
				<OutputControl
					value={value}
					onChangeFn={onChangeFn}
				/>,
			),
		);
	try {
		let value = {
			set: [
				{
					weight: 1,
					rules: [],
					roll: [],
				},
			],
		} as unknown as OutputSchema.Type;
		await renderOutputFn(value);
		const addRoll = container.querySelector<HTMLButtonElement>(
			'[data-ui="EditorRollsCollection"] [data-ui="EditorCollectionAdd"]',
		);
		const removeRoll = container.querySelector<HTMLButtonElement>(
			'[data-ui="EditorRollsCollection"] [data-ui="EditorCollectionRemove"]',
		);
		expect(addRoll?.disabled).toBe(false);
		expect(removeRoll?.disabled).toBe(true);
		expect(container.textContent).not.toContain("Roll type");

		await act(async () => addRoll?.click());
		value = onChangeFn.mock.lastCall?.[0] as OutputSchema.Type;
		await renderOutputFn(value);
		expect(container.textContent).toContain("Roll type");
		expect(
			container.querySelector(
				'[data-ui="EditorChoiceControlOption"][data-ui-selected="true"]',
			),
		).toBeNull();
		expect(container.querySelector('[data-ui="EditorDropsCollection"]')).toBeNull();

		const guaranteed = Array.from(container.querySelectorAll("button")).find(
			(button) => button.textContent?.includes("Guaranteed") === true,
		);
		await act(async () => guaranteed?.click());
		value = onChangeFn.mock.lastCall?.[0] as OutputSchema.Type;
		await renderOutputFn(value);
		const addDrop = container.querySelector<HTMLButtonElement>(
			'[data-ui="EditorDropsCollection"] [data-ui="EditorCollectionAdd"]',
		);
		const removeDrop = container.querySelector<HTMLButtonElement>(
			'[data-ui="EditorDropsCollection"] [data-ui="EditorCollectionRemove"]',
		);
		expect(addDrop?.disabled).toBe(false);
		expect(removeDrop?.disabled).toBe(true);
		expect(container.querySelector('[data-label="Dropped item"]')).toBeNull();

		await act(async () => addDrop?.click());
		value = onChangeFn.mock.lastCall?.[0] as OutputSchema.Type;
		await renderOutputFn(value);
		expect(container.querySelector('[data-label="Dropped item"]')).not.toBeNull();

		await act(async () =>
			container
				.querySelector<HTMLButtonElement>(
					'[data-ui="EditorDropsCollection"] [data-ui="EditorCollectionRemove"]',
				)
				?.click(),
		);
		value = onChangeFn.mock.lastCall?.[0] as OutputSchema.Type;
		expect(value.set[0]).toMatchObject({
			weight: 1,
			rules: [],
			roll: [
				{
					type: "guaranteed",
					drop: [],
				},
			],
		});
		await renderOutputFn(value);

		await act(async () =>
			container
				.querySelector<HTMLButtonElement>(
					'[data-ui="EditorRollsCollection"] [data-ui="EditorCollectionRemove"]',
				)
				?.click(),
		);
		value = onChangeFn.mock.lastCall?.[0] as OutputSchema.Type;
		expect(value).toMatchObject({
			set: [
				{
					weight: 1,
					rules: [],
					roll: [],
				},
			],
		});
	} finally {
		await act(async () => root.unmount());
		container.remove();
	}
});

it.each([
	"guaranteed",
	"chance",
] as const)("opens the exact drop in a %s roll on first form render", async (type) => {
	const drop = (itemId: string) => ({
		itemId,
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
							scope: "board",
							distance: "far",
							selector: {
								type: "item",
								itemId: "other",
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
				].map((itemId) => ({
					type: "exists",
					query: {
						scope: "board",
						distance: "far",
						selector: {
							type: "item",
							itemId,
						},
					},
				})),
			},
		],
	});
	const targetDrops = [
		drop("meat"),
		drop("bones"),
	];
	const roll =
		type === "chance"
			? {
					type,
					chance: 0.5,
					drop: targetDrops,
				}
			: {
					type,
					drop: targetDrops,
				};
	const value = OutputSchema.parse({
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
				<OutputControl
					value={value}
					onChangeFn={() => {}}
				/>,
			),
		);
		expect(container.querySelector('[data-label="Output sets"]')?.textContent).toBe("1");
		expect(container.querySelector('[data-label="Output set 2 rolls"]')?.textContent).toBe("2");
		expect(container.querySelector('[data-label="Drops"]')?.textContent).toBe("1");
		expect(container.querySelector('[data-label="Dropped item"]')?.textContent).toBe("bones");
		expect(container.querySelector('[data-label="Rules"]')?.textContent).toBe("1");
		expect(container.querySelector('[data-label="Rule 2 conditions"]')?.textContent).toBe("1");
		expect(container.querySelector('[data-label="Selected item"]')?.textContent).toBe("permit");
	} finally {
		await act(async () => root.unmount());
		container.remove();
	}
});

it("focuses and edits a set rule without changing the selected set's drops", async () => {
	const condition = (itemId: string) => ({
		type: "exists",
		query: {
			scope: "any",
			selector: {
				type: "item",
				itemId,
			},
		},
	});
	const value = OutputSchema.parse({
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
						drop: [
							{
								itemId: "ore",
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
