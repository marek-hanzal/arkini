import { describe, expect, it } from "vitest";
import { readItemChainsFn } from "~/item-chain/fn/readItemChainsFn";
import {
	catalogFn,
	clockFn,
	finalIdsFn,
	itemFn,
	lineFn,
	mergeFn,
	outputFn,
} from "./readItemChainsFn.test/fixtures";
import { OutputSchema } from "~/production-output/schema/OutputSchema";
describe("chain termination and authored output boundaries", () => {
	it("distinguishes a truncated Clock from a final item", () => {
		const items = catalogFn(
			itemFn("root", {
				merge: [
					mergeFn("target", "clock"),
				],
			}),
			itemFn("clock", {
				clock: clockFn("end"),
			}),
			itemFn("end"),
		);
		const limited = readItemChainsFn(items, "root", 1);
		expect(limited.chains[0].outcomes[0].stop).toBe("depth");
		expect(finalIdsFn(readItemChainsFn(items, "root", 2))).toEqual([
			"end",
		]);
	});

	it("cuts same-branch Clock cycles while preserving independent branches", () => {
		const items = catalogFn(
			itemFn("root", {
				clock: clockFn("a", "b"),
			}),
			itemFn("a", {
				clock: clockFn("root"),
			}),
			itemFn("b", {
				clock: clockFn("end"),
			}),
			itemFn("end"),
		);
		const result = readItemChainsFn(items, "root");
		expect(result.chains[0].outcomes.some((outcome) => outcome.stop === "cycle")).toBe(true);
		expect(finalIdsFn(result)).toEqual([
			"end",
		]);
	});

	it("bounds fan-out without reporting an omitted branch as an empty expiry", () => {
		const items = catalogFn(
			itemFn("root", {
				clock: clockFn(
					...Array.from(
						{
							length: 450,
						},
						(_, index) => `item-${index}`,
					),
				),
			}),
		);
		const result = readItemChainsFn(items, "root");
		expect(result.truncated).toBe(true);
		expect(result.chains[0].steps[0].branches).toHaveLength(400);
		expect(result.chains[0].outcomes.some((outcome) => outcome.stop === "no-output")).toBe(
			false,
		);
	});

	it("preserves roll/set/candidate grouping and excludes impossible chance rolls", () => {
		const output = OutputSchema.parse({
			set: [
				{
					weight: 2,
					roll: [
						{
							type: "chance",
							chance: 0,
							drop: [
								{
									itemId: "never",
									quantity: {
										min: 1,
										max: 1,
									},
									placement: "drop",
									rules: [],
								},
							],
						},
						{
							type: "weight",
							quantity: {
								min: 2,
								max: 3,
							},
							drop: [
								{
									weight: 1,
									drop: outputFn("a", "b").set[0].roll[0].drop,
								},
								{
									weight: 3,
									drop: outputFn("c").set[0].roll[0].drop,
								},
							],
						},
					],
				},
				{
					weight: 1,
					roll: outputFn("d").set[0].roll,
				},
			],
		});
		const items = catalogFn(
			itemFn("root", {
				clock: {
					...clockFn("unused"),
					onExpire: output,
				},
			}),
			...[
				"a",
				"b",
				"c",
				"d",
			].map((id) => itemFn(id)),
		);
		const branches = readItemChainsFn(items, "root").chains[0].steps[0].branches;
		expect(branches.map((node) => node.itemId)).toEqual([
			"a",
			"b",
			"c",
			"d",
		]);
		expect(branches[0].output).toMatchObject({
			set: 0,
			alternative: true,
			roll: 1,
			candidate: 0,
			selections: {
				min: 2,
				max: 3,
			},
		});
		expect(branches[1].output?.candidate).toBe(0);
		expect(branches[2].output?.candidate).toBe(1);
		expect(branches[3].output?.set).toBe(1);
	});

	it("does not invent pulses before a shorter lifetime and retains the boundary pulse", () => {
		const items = catalogFn(
			itemFn("root", {
				clock: {
					...clockFn("end"),
					intervalMs: 2000,
				},
				lines: [
					lineFn("auto", true, outputFn("extra")),
				],
			}),
			itemFn("end"),
			itemFn("extra"),
		);
		expect(finalIdsFn(readItemChainsFn(items, "root"))).toEqual([
			"end",
		]);
		const boundary = {
			...items,
			root: itemFn("root", {
				...items.root,
				clock: {
					...items.root.clock,
					intervalMs: 1000,
				},
			}),
		};
		expect(finalIdsFn(readItemChainsFn(boundary, "root"))).toEqual([
			"extra",
			"end",
		]);
	});

	it("retains participants without restarting their Clock and respects first-target merge precedence", () => {
		const items = catalogFn(
			itemFn("root", {
				merge: [
					{
						target: {
							type: "item",
							itemId: "target",
						},
						action: "use",
						effect: "keep",
						output: outputFn("drop"),
					},
					mergeFn("target", "shadowed"),
				],
			}),
			itemFn("target", {
				clock: clockFn("wrong-fresh-expiry"),
			}),
			itemFn("drop"),
		);
		const result = readItemChainsFn(items, "root");
		expect(result.chains).toHaveLength(1);
		expect(
			result.chains[0].outcomes
				.filter((outcome) => outcome.stop === "retained")
				.map((outcome) => outcome.itemId),
		).toEqual([
			"target",
			"root",
		]);
		expect(finalIdsFn(result)).toEqual([
			"drop",
		]);
	});
});
