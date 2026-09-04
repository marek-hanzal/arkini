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
});
