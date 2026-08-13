import { describe, expect, it } from "vitest";

import {
	DefaultPlannerCoverageTierSpec,
	parsePlannerCoverageTierSpec,
} from "../../../cli/editor/parsePlannerCoverageTierSpec";

const completeBudget = ({
	expanded,
	queued,
	routePlans,
	traceLength,
}: {
	readonly expanded: number;
	readonly queued: number;
	readonly routePlans: number;
	readonly traceLength: number;
}) => ({
	maximumExpandedStates: expanded,
	maximumQueuedStates: queued,
	maximumRoutePlans: routePlans,
	maximumTraceLength: traceLength,
});

describe("parsePlannerCoverageTierSpec", () => {
	it("parses the default increasing saturation tiers", () => {
		expect(parsePlannerCoverageTierSpec(DefaultPlannerCoverageTierSpec)).toEqual([
			{
				budget: completeBudget({
					expanded: 25,
					queued: 1,
					routePlans: 1,
					traceLength: 500,
				}),
				id: "smoke",
			},
			{
				budget: completeBudget({
					expanded: 100,
					queued: 4,
					routePlans: 4,
					traceLength: 500,
				}),
				id: "narrow",
			},
			{
				budget: completeBudget({
					expanded: 250,
					queued: 8,
					routePlans: 8,
					traceLength: 500,
				}),
				id: "medium",
			},
			{
				budget: completeBudget({
					expanded: 1_000,
					queued: 16,
					routePlans: 16,
					traceLength: 500,
				}),
				id: "editor",
			},
		]);
	});

	it("rejects malformed or non-positive limits", () => {
		expect(() => parsePlannerCoverageTierSpec("smoke=25:1:500")).toThrow(
			"must define exactly four budget limits",
		);
		expect(() => parsePlannerCoverageTierSpec("smoke=0:1:1:500")).toThrow(
			"invalid maximumExpandedStates: 0",
		);
	});
});
