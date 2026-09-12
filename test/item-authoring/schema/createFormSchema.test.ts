import { describe, expect, it } from "vitest";

import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { FormValues } from "~/item-authoring/schema/FormSchema";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { createFormSchema } from "~/item-authoring/schema/createFormSchema";
import {
	createProducerItem,
	createSimpleItem,
} from "~test/game-config-validation/support/gameValidationTestSource";

const createTargetPaidInput = (itemId: string) => ({
	type: "units" as const,
	units: {
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

const readFormValues = (item: ItemSchema.Type): FormValues => ({
	...item,
	description: item.description ?? "",
	asset: {
		scale: item.asset.scale,
		default: [
			item.asset.default[0],
			"",
		],
	},
});

describe("createFormSchema", () => {
	it("rejects a Spend merge action after Units are disabled on its source", () => {
		const target = createSimpleItem("target");
		const source = {
			...createSimpleItem("source"),
			merge: [
				{
					action: "spend" as const,
					effect: "keep" as const,
					target: {
						type: "item" as const,
						itemId: target.id,
					},
				},
			],
		} satisfies ItemSchema.Type;
		const project = {
			config: {
				items: {
					[source.id]: source,
					[target.id]: target,
				},
			} as GameConfigSchema.Type,
		};
		const result = createFormSchema(project, source.uid).safeParse(readFormValues(source));

		expect(result.success).toBe(false);
		if (result.success) return;
		expect(result.error.issues).toContainEqual(
			expect.objectContaining({
				message: "Enable Units on this item before selecting Spend.",
				path: [
					"merge",
					0,
					"action",
				],
			}),
		);
	});

	it("rejects a Spend target effect when the selected item has no Units", () => {
		const target = createSimpleItem("target");
		const source = {
			...createSimpleItem("source"),
			merge: [
				{
					action: "consume" as const,
					effect: "spend" as const,
					target: {
						type: "item" as const,
						itemId: target.id,
					},
				},
			],
		} satisfies ItemSchema.Type;
		const project = {
			config: {
				items: {
					[source.id]: source,
					[target.id]: target,
				},
			} as GameConfigSchema.Type,
		};

		const result = createFormSchema(project, source.uid).safeParse(readFormValues(source));

		expect(result.success).toBe(false);
		if (result.success) return;
		expect(result.error.issues).toContainEqual(
			expect.objectContaining({
				message: "Selected target must have Units enabled before choosing Spend.",
				path: [
					"merge",
					0,
					"effect",
				],
			}),
		);
	});

	it("accepts a Spend target effect when the selected item has Units", () => {
		const target = {
			...createSimpleItem("target"),
			units: {
				amount: 2,
			},
		};
		const source = {
			...createSimpleItem("source"),
			merge: [
				{
					action: "consume" as const,
					effect: "spend" as const,
					target: {
						type: "item" as const,
						itemId: target.id,
					},
				},
			],
		} satisfies ItemSchema.Type;
		const project = {
			config: {
				items: {
					[source.id]: source,
					[target.id]: target,
				},
			} as GameConfigSchema.Type,
		};

		expect(
			createFormSchema(project, source.uid).safeParse(readFormValues(source)).success,
		).toBe(true);
	});

	it("rejects a target-paid Units that selects an item without Units", () => {
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

	it("accepts the same Units target after Units are enabled", () => {
		const target = {
			...createSimpleItem("target"),
			units: {
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

	it("accepts a self-paid Units bound to a spent line owner", () => {
		const producer = {
			...createProducerItem({
				id: "producer",
				input: [
					{
						type: "units" as const,
						units: {
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
			units: {
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

	it("rejects a self-paid Units after Units are disabled on its owner", () => {
		const producer = createProducerItem({
			id: "producer",
			input: [
				{
					type: "units" as const,
					units: {
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
				message: "Enable Units on this item before selecting Self.",
				path: [
					"lines",
					0,
					"input",
					0,
					"units",
					"from",
				],
			}),
		);
	});

	it("rebinds an empty self-paid Units selector when a new line owner's ID is entered", () => {
		const producer = {
			...createProducerItem({
				id: "draft-owner",
				input: [
					{
						type: "units" as const,
						units: {
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
			units: {
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
		expect(firstInput?.type).toBe("units");
		if (line === undefined || firstInput?.type !== "units") return;
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
	it("binds nested action Self inputs to the renamed owner and reports disabled Units at the action field", () => {
		const owner = {
			...createSimpleItem("draft-owner"),
			units: {
				amount: 2,
			},
			action: {
				type: "space" as const,
				space: 3,
				input: [
					{
						...createTargetPaidInput(""),
						units: {
							cost: 1,
							from: "self" as const,
						},
					},
				],
				rules: [],
			},
		};
		const project = {
			config: {
				items: {},
			} as GameConfigSchema.Type,
		};
		const schema = createFormSchema(project, owner.uid);
		const form = {
			...readFormValues(owner),
			id: "final-owner",
		};
		const accepted = schema.safeParse(form);
		expect(accepted.success).toBe(true);
		if (!accepted.success || accepted.data.type !== "common")
			throw new Error("Expected Common action.");
		expect(accepted.data.action?.input[0]).toMatchObject({
			query: {
				distance: "self",
				selector: {
					itemId: "final-owner",
				},
			},
		});
		const rejected = schema.safeParse({
			...form,
			units: undefined,
		});
		expect(rejected.success).toBe(false);
		if (rejected.success) throw new Error("Expected invalid owner Units.");
		expect(rejected.error.issues).toContainEqual(
			expect.objectContaining({
				path: [
					"action",
					"input",
					0,
					"units",
					"from",
				],
			}),
		);
	});
});
