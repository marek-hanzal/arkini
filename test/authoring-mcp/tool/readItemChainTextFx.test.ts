import { Effect } from "effect";
import { expect, it } from "vitest";
import { readItemChainTextFx } from "~/authoring-mcp/tool/readItemChainTextFx";
import { OutputSchema } from "~/production-output/schema/OutputSchema";
import { createJobTestConfig } from "~test/production-job/support/jobTestConfig";
import {
	catalogFn,
	clockFn,
	itemFn,
	lineFn,
	mergeFn,
	outputFn,
} from "~test/item-chain/fn/readItemChainsFn.test/fixtures";
import { createToolProject } from "./support/createToolProject";

it("keeps nested Clock details, local quantities and alternative roll provenance in the text projection", async () => {
	const weighted = OutputSchema.parse({
		set: [
			{
				weight: 7,
				roll: [
					{
						type: "chance",
						chance: 0.25,
						drop: outputFn("bonus").set[0].roll[0].drop,
					},
					{
						type: "weight",
						quantity: {
							min: 2,
							max: 3,
						},
						drop: [
							{
								rules: [],
								weight: 9,
								drop: [
									{
										...outputFn("bonus").set[0].roll[0].drop[0],
										quantity: {
											min: 4,
											max: 6,
										},
									},
								],
							},
							{
								rules: [],
								weight: 4,
								drop: outputFn("end").set[0].roll[0].drop,
							},
						],
					},
				],
			},
			{
				weight: 1,
				roll: outputFn("end").set[0].roll,
			},
		],
	});
	const project = createToolProject({
		...createJobTestConfig(),
		items: catalogFn(
			itemFn("root", {
				title: "Starting item",
				merge: [
					mergeFn("target", "timed"),
				],
			}),
			itemFn("target"),
			itemFn("timed", {
				clock: {
					...clockFn("later"),
					enable: false,
					intervalMs: 5000,
					durationMs: 30000,
				},
				lines: [
					{
						...lineFn("clock-line", true, weighted),
						title: "Pulse line",
						runtimeMs: 2000,
					},
				],
			}),
			itemFn("later", {
				clock: {
					...clockFn("end"),
					durationMs: 60000,
				},
			}),
			itemFn("end"),
			itemFn("bonus"),
		),
	});
	const before = JSON.stringify(project);
	const text = await Effect.runPromise(readItemChainTextFx(project, "root"));
	const details = text.slice(text.indexOf("Details:"));
	for (const fragment of [
		"Starting item [root]",
		"Drop onto: target [target]",
		"Source: consume",
		"Target: replace",
		"Clock line: Pulse line [clock-line]",
		"Every: 5 s",
		"Line duration: 2 s",
		"Lifetime: 30 s",
		"Disabled by default: yes",
		"Inputs: 0 (not expanded)",
		"bonus [bonus] ×4–6",
		"Alternative set 1 (weight 7) · Roll 1: chance · Chance 25%",
		"Alternative set 1 (weight 7) · Roll 2: weight · Candidate 1 · Candidate weight 9 · Selections ×2–3",
		"Alternative set 2 (weight 1) · Roll 1: guaranteed",
		"later [later] · Clock expiry",
		"After: 60 s",
		"end [end] ×1 · Final item",
	])
		expect(details).toContain(fragment);
	expect(text).toContain("Repeated output · Conditional or alternative");
	expect(details.indexOf("later [later] · Clock expiry")).toBeGreaterThan(
		details.indexOf("timed [timed] · Clock expiry"),
	);
	expect(JSON.stringify(project)).toBe(before);
});

it("reports bounded, cyclic and empty branches without presenting them as completed yields", async () => {
	const project = createToolProject({
		...createJobTestConfig(),
		items: catalogFn(
			...Array.from(
				{
					length: 7,
				},
				(_, i) =>
					itemFn(`step-${i}`, {
						clock: clockFn(`step-${i + 1}`),
					}),
			),
			itemFn("cycle", {
				clock: clockFn("cycle"),
			}),
			itemFn("empty", {
				clock: {
					durationMs: 1000,
					enable: true,
					rules: [],
				},
			}),
		),
	});
	const limited = await Effect.runPromise(readItemChainTextFx(project, "step-0"));
	expect(limited).toContain("step-5 [step-5] ×1 · Depth limit");
	expect(limited).not.toContain("step-6 [step-6]");
	const cycle = await Effect.runPromise(readItemChainTextFx(project, "cycle"));
	expect(cycle).toContain("cycle [cycle] ×1 · Clock loop");
	const empty = await Effect.runPromise(readItemChainTextFx(project, "empty"));
	expect(empty.slice(empty.indexOf("Details:"))).toContain("No items emitted");
});
