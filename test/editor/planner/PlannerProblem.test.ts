import { describe, expect, it } from "vitest";

import { mergePlannerGoalAgenda } from "~/editor/planner/PlannerProblem";

describe("mergePlannerGoalAgenda", () => {
	it("keeps the active goal first and preserves the strongest demand per item", () => {
		expect(
			mergePlannerGoalAgenda({
				activeGoal: {
					itemId: "item:water",
					quantity: 1,
				},
				goals: [
					{
						itemId: "item:stone",
						minimumCharges: 2,
						quantity: 3,
					},
					{
						itemId: "item:water",
						minimumCharges: 4,
						quantity: 2,
					},
					{
						itemId: "item:log",
						quantity: 5,
					},
					{
						itemId: "item:stone",
						minimumCharges: 1,
						quantity: 7,
					},
				],
			}),
		).toEqual([
			{
				itemId: "item:water",
				minimumCharges: 4,
				quantity: 2,
			},
			{
				itemId: "item:log",
				minimumCharges: 0,
				quantity: 5,
			},
			{
				itemId: "item:stone",
				minimumCharges: 2,
				quantity: 7,
			},
		]);
	});
});
