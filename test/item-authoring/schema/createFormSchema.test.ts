import { editorTestConfig } from "~test/project-authoring/support/editorTestPayload";
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
	artwork: {
		scale: item.artwork.scale,
		default: [
			item.artwork.default[0],
			"",
		],
	},
});

describe("createFormSchema", () => {
	it("rejects ambiguous receiver transport definitions at the second action", () => {
		const source = createSimpleItem("portal");
		const project = {
			config: {
				items: {
					[source.id]: source,
				},
			} as GameConfigSchema.Type,
		};
		const form = readFormValues(source);
		const result = createFormSchema(project, source.uid).safeParse({
			...form,
			merge: [
				{
					action: "space",
					space: 1,
					effect: "keep",
				},
				{
					action: "space",
					space: 2,
					effect: "keep",
				},
			],
		});
		expect(result.success).toBe(false);
		if (!result.success)
			expect(result.error.issues).toContainEqual(
				expect.objectContaining({
					path: [
						"merge",
						1,
						"action",
					],
				}),
			);
	});

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
});

it("preserves a template outcome in an item draft and rejects a removed template reference", () => {
	const source = createProducerItem({
		id: "portal",
	});
	const form = readFormValues(source);
	const edited = {
		...form,
		lines: form.lines!.map((line) => ({
			...line,
			outcome: {
				set: [
					{
						rules: [],
						roll: [
							{
								type: "guaranteed",
								outcome: [
									{
										type: "template",
										templateUid: "destination",
										rules: [],
									},
								],
							},
						],
					},
				],
			},
		})),
	};
	const config = {
		...editorTestConfig,
		items: {
			portal: source,
		},
		templates: [
			{
				uid: "destination",
				title: "Destination",
				width: 2,
				height: 2,
				board: [],
			},
		],
	} as GameConfigSchema.Type;
	const parsed = createFormSchema(
		{
			config,
		},
		source.uid,
	).safeParse(edited);
	expect(parsed.success).toBe(true);
	if (parsed.success)
		expect(parsed.data.lines[0]!.outcome!.set[0]!.roll[0]!.outcome[0]).toEqual({
			type: "template",
			templateUid: "destination",
			rules: [],
		});
	const missing = createFormSchema(
		{
			config: {
				...config,
				templates: [],
			},
		},
		source.uid,
	).safeParse(edited);
	expect(missing.success).toBe(false);
	if (!missing.success)
		expect(missing.error.issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					path: [
						"lines",
						0,
						"outcome",
						"set",
						0,
						"roll",
						0,
						"outcome",
						0,
						"templateUid",
					],
				}),
			]),
		);
});
