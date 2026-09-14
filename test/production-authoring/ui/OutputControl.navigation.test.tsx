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
		outputCandidateIndex: 1,
		ruleIndex: 1,
		whenIndex: 1,
	}),
}));
vi.mock("~/authoring-form/ui/EditorItemThumbnail", () => ({
	EditorItemThumbnail: () => null,
	EditorItemSearchThumbnail: () => null,
}));
vi.mock("~/item-authoring/ui/useFormValidationIssues", () => ({
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
		const add = container.querySelector<HTMLButtonElement>('button[title="Add output set"]');
		const remove = container.querySelector<HTMLButtonElement>(
			'button[title="Remove output set"]',
		);
		expect(add?.disabled).toBe(false);
		expect(remove?.disabled).toBe(true);

		await act(async () => add?.click());
		expect(onChangeFn).toHaveBeenCalledWith({
			set: [
				expect.objectContaining({
					weight: 1,
					roll: [
						expect.objectContaining({
							type: "guaranteed",
						}),
					],
				}),
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
	"weight",
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
		type === "weight"
			? {
					type,
					quantity: {
						min: 1,
						max: 1,
					},
					drop: [
						{
							weight: 1,
							drop: [
								drop("other"),
							],
						},
						{
							weight: 1,
							drop: targetDrops,
						},
					],
				}
			: type === "chance"
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
		if (type === "weight")
			expect(container.querySelector('[data-label="Weighted candidates"]')?.textContent).toBe(
				"1",
			);
	} finally {
		await act(async () => root.unmount());
		container.remove();
	}
});
