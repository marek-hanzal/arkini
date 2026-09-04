import { describe, expect, it } from "vitest";

import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { FormValues } from "~/item-authoring/schema/FormSchema";
import { createFormSchema } from "~/item-authoring/schema/createFormSchema";
import {
	createProducerItem,
	createSimpleItem,
} from "~test/game-config-validation/support/gameValidationTestSource";

const createTargetPaidInput = (itemId: string) => ({
	type: "deposit" as const,
	charges: {
		cost: 1,
		from: "target" as const,
	},
	query: {
		scope: "board" as const,
		distance: "close" as const,
		selector: {
			type: "item" as const,
			itemId,
		},
	},
});

const readFormValues = (item: ReturnType<typeof createProducerItem>): FormValues => ({
	...item,
	asset: {
		default: [
			item.asset.default[0],
			"",
		],
		sources: [],
	},
});

describe("createFormSchema", () => {
	it("rejects a target-paid Deposit that selects an item without Charges", () => {
		const target = createSimpleItem("target");
		const producer = createProducerItem({
			id: "producer",
			input: [
				createTargetPaidInput(target.id),
			],
		});
		const project = {
			config: {
				items: {
					[target.id]: target,
					[producer.id]: producer,
				},
			} as GameConfigSchema.Type,
		};

		const result = createFormSchema(project, producer.uid).safeParse(readFormValues(producer));

		expect(result.success).toBe(false);
		if (result.success) return;
		expect(result.error.issues).toContainEqual(
			expect.objectContaining({
				path: [
					"lines",
					0,
					"input",
					0,
					"query",
					"selector",
					"itemId",
				],
			}),
		);
	});

	it("accepts the same Deposit target after Charges are enabled", () => {
		const target = {
			...createSimpleItem("target"),
			charges: {
				amount: 1,
			},
		};
		const producer = createProducerItem({
			id: "producer",
			input: [
				createTargetPaidInput(target.id),
			],
		});
		const project = {
			config: {
				items: {
					[target.id]: target,
					[producer.id]: producer,
				},
			} as GameConfigSchema.Type,
		};

		expect(
			createFormSchema(project, producer.uid).safeParse(readFormValues(producer)).success,
		).toBe(true);
	});

	it("accepts a self-paid Deposit bound to a charged line owner", () => {
		const producer = {
			...createProducerItem({
				id: "producer",
				input: [
					{
						type: "deposit" as const,
						charges: {
							cost: 1,
							from: "self" as const,
						},
						query: {
							scope: "board" as const,
							distance: "self" as const,
							selector: {
								type: "item" as const,
								itemId: "producer",
							},
						},
					},
				],
			}),
			charges: {
				amount: 1,
			},
		};
		const project = {
			config: {
				items: {
					[producer.id]: producer,
				},
			} as GameConfigSchema.Type,
		};

		expect(
			createFormSchema(project, producer.uid).safeParse(readFormValues(producer)).success,
		).toBe(true);
	});

	it("rejects a self-paid Deposit after Charges are disabled on its owner", () => {
		const producer = createProducerItem({
			id: "producer",
			input: [
				{
					type: "deposit" as const,
					charges: {
						cost: 1,
						from: "self" as const,
					},
					query: {
						scope: "board" as const,
						distance: "self" as const,
						selector: {
							type: "item" as const,
							itemId: "producer",
						},
					},
				},
			],
		});
		const project = {
			config: {
				items: {
					[producer.id]: producer,
				},
			} as GameConfigSchema.Type,
		};

		const result = createFormSchema(project, producer.uid).safeParse(readFormValues(producer));

		expect(result.success).toBe(false);
		if (result.success) return;
		expect(result.error.issues).toContainEqual(
			expect.objectContaining({
				message: "Enable Charges on this item before selecting Self.",
				path: [
					"lines",
					0,
					"input",
					0,
					"charges",
					"from",
				],
			}),
		);
	});

	it("rebinds an empty self-paid Deposit selector when a new line owner's ID is entered", () => {
		const producer = {
			...createProducerItem({
				id: "draft-owner",
				input: [
					{
						type: "deposit" as const,
						charges: {
							cost: 1,
							from: "self" as const,
						},
						query: {
							scope: "board" as const,
							distance: "self" as const,
							selector: {
								type: "item" as const,
								itemId: "draft-owner",
							},
						},
					},
				],
			}),
			charges: {
				amount: 1,
			},
		};
		const project = {
			config: {
				items: {},
			} as GameConfigSchema.Type,
		};
		const formValues = readFormValues(producer);
		const line = formValues.lines?.[0];
		const firstInput = line?.input[0];
		expect(firstInput?.type).toBe("deposit");
		if (line === undefined || firstInput?.type !== "deposit") return;
		const result = createFormSchema(project, producer.uid).safeParse({
			...formValues,
			id: "final-owner",
			lines: [
				{
					...line,
					input: [
						{
							...firstInput,
							query: {
								...firstInput.query,
								selector: {
									...firstInput.query.selector,
									itemId: "",
								},
							},
						},
						...line.input.slice(1),
					],
				},
				...(formValues.lines?.slice(1) ?? []),
			],
		});

		expect(result.success).toBe(true);
		if (!result.success || !("lines" in result.data)) return;
		const input = result.data.lines?.[0]?.input[0];
		expect(input).toEqual(
			expect.objectContaining({
				query: expect.objectContaining({
					distance: "self",
					selector: expect.objectContaining({
						itemId: "final-owner",
					}),
				}),
			}),
		);
	});
});
