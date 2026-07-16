import { describe, expect, it } from "vitest";

import { LineRunPlanSchema } from "~/engine/line/schema/run/LineRunPlanSchema";
import { LineRunResolutionSchema } from "~/engine/line/schema/run/LineRunResolutionSchema";

const plan = {
	ownerItemId: "runtime:workshop",
	lineId: "line:workshop:build",
	runtimeMs: 500,
	input: [
		{
			type: "simple" as const,
		},
	],
};

describe("line run schemas", () => {
	it("accepts one exact line-run plan", () => {
		expect(LineRunPlanSchema.parse(plan)).toEqual(plan);
	});

	it("accepts a ready resolution with a plan", () => {
		expect(
			LineRunResolutionSchema.parse({
				ownerItemId: plan.ownerItemId,
				lineId: plan.lineId,
				show: true,
				enable: true,
				runtimeMs: plan.runtimeMs,
				input: [
					{
						resolution: {
							type: "simple",
							ready: true,
						},
						plan: {
							type: "simple",
						},
					},
				],
				ready: true,
				plan,
			}),
		).toMatchObject({
			ready: true,
			plan,
		});
	});
});
