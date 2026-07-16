import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { planLineRunFx } from "~/engine/line/fx/run/planLineRunFx";
import type { InputRunResolutionSchema } from "~/engine/input/schema/run/InputRunResolutionSchema";

const simpleInput = {
	resolution: {
		type: "simple",
		ready: true,
	},
	plan: {
		type: "simple",
	},
} satisfies InputRunResolutionSchema.Type;

const materialInput = {
	resolution: {
		type: "materials",
		mode: "consume",
		required: {
			min: 2,
			max: 2,
		},
		storedQuantity: 2,
		maxStoredQuantity: 4,
		runQuantity: 2,
		missingQuantity: 0,
		availableCapacity: 2,
		ready: true,
	},
	plan: {
		type: "materials",
		mode: "consume",
		quantity: 2,
		item: [
			{
				itemId: "runtime:water",
				quantity: 2,
			},
		],
	},
} satisfies InputRunResolutionSchema.Type;

const planFx = ({
	enable = true,
	input = [
		materialInput,
		simpleInput,
	] as [
		InputRunResolutionSchema.Type,
		...InputRunResolutionSchema.Type[],
	],
}: {
	enable?: boolean;
	input?: [
		InputRunResolutionSchema.Type,
		...InputRunResolutionSchema.Type[],
	];
} = {}) => {
	return planLineRunFx({
		enable,
		input,
		lineId: "line:workshop:build",
		ownerItemId: "runtime:workshop",
		runtimeMs: 500,
	});
};

describe("planLineRunFx", () => {
	it("preserves configured input order in one exact plan", () => {
		expect(Effect.runSync(planFx())).toEqual({
			ownerItemId: "runtime:workshop",
			lineId: "line:workshop:build",
			runtimeMs: 500,
			input: [
				materialInput.plan,
				simpleInput.plan,
			],
		});
	});

	it("returns undefined while the line is disabled", () => {
		expect(
			Effect.runSync(
				planFx({
					enable: false,
				}),
			),
		).toBeUndefined();
	});

	it("returns undefined when a ready input has no concrete plan", () => {
		expect(
			Effect.runSync(
				planFx({
					input: [
						{
							...materialInput,
							plan: undefined,
						},
					],
				}),
			),
		).toBeUndefined();
	});
});
