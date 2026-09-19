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
describe("root-owned interaction chains", () => {
	it("keeps opposite merge directions distinct and never follows intermediate merges", () => {
		const items = catalogFn(
			itemFn("fawn", {
				merge: [
					mergeFn("dynamite", "fed"),
				],
			}),
			itemFn("dynamite", {
				merge: [
					mergeFn("fawn", "steak"),
				],
			}),
			itemFn("fed", {
				clock: clockFn("fire"),
				merge: [
					mergeFn("water", "rescued"),
				],
			}),
			itemFn("fire", {
				clock: clockFn("injured", "sticks"),
			}),
			itemFn("injured", {
				clock: clockFn("meat"),
			}),
			itemFn("meat", {
				merge: [
					mergeFn("salt", "jerky"),
				],
			}),
			itemFn("sticks"),
			itemFn("steak"),
		);
		expect(finalIdsFn(readItemChainsFn(items, "fawn"))).toEqual([
			"meat",
			"sticks",
		]);
		expect(finalIdsFn(readItemChainsFn(items, "dynamite"))).toEqual([
			"steak",
		]);
		expect(readItemChainsFn(items, "sticks").chains).toEqual([]);
	});

	it("shows periodic line outputs once and ends normally when a puppy returns without Clock", () => {
		const items = catalogFn(
			itemFn("pillow", {
				merge: [
					mergeFn("puppy", "tearing"),
				],
			}),
			itemFn("puppy", {
				merge: [
					mergeFn("food", "fed"),
				],
			}),
			itemFn("tearing", {
				clock: {
					...clockFn("puppy"),
					intervalMs: 100,
					durationMs: 1000,
				},
				lines: [
					lineFn("tearing", true, outputFn("cotton")),
					lineFn("manual", false, outputFn("ignored")),
				],
			}),
			itemFn("cotton"),
		);
		const result = readItemChainsFn(items, "pillow");
		expect(finalIdsFn(result)).toEqual([
			"cotton",
			"puppy",
		]);
		expect(result.chains[0].outcomes).toContainEqual({
			itemId: "cotton",
			stop: "final",
			periodic: true,
			conditional: false,
		});
		expect(result.chains[0].outcomes.some((outcome) => outcome.stop === "cycle")).toBe(false);
		expect(readItemChainsFn(items, "puppy").chains.map((chain) => chain.targetId)).toEqual([
			"food",
		]);
	});

	it("follows Clock on periodic outputs without tracing the producing line's inputs", () => {
		const line = {
			...lineFn("auto", true, outputFn("fresh")),
			input: [
				{
					type: "materials",
					query: {
						scope: "any",
						selector: {
							type: "item",
							itemId: "input",
						},
					},
					quantity: {
						min: 1,
						max: 1,
					},
					mode: "consume",
				},
			],
		};
		const items = catalogFn(
			itemFn("source", {
				clock: {
					intervalMs: 1000,
					enable: true,
					rules: [],
				},
				lines: [
					line,
				],
			}),
			itemFn("fresh", {
				clock: clockFn("spoiled"),
				merge: [
					mergeFn("salt", "other"),
				],
			}),
			itemFn("spoiled"),
		);
		const result = readItemChainsFn(items, "source");
		expect(finalIdsFn(result)).toEqual([
			"spoiled",
		]);
		expect(result.chains[0].outcomes).toContainEqual({
			itemId: "source",
			stop: "ongoing",
			periodic: false,
			conditional: false,
		});
		expect(
			result.chains[0].outcomes.find((outcome) => outcome.itemId === "spoiled")?.periodic,
		).toBe(true);
	});

	it("retains every weighted Clock alternative without claiming simultaneous guaranteed outcomes", () => {
		const items = catalogFn(
			itemFn("source", {
				clock: {
					intervalMs: 1000,
					enable: true,
					rules: [],
				},
				lines: [
					{
						...lineFn("first", true, outputFn("one")),
						clockWeight: 1,
					},
					{
						...lineFn("second", true, outputFn("two")),
						clockWeight: 3,
						show: false,
					},
					lineFn("manual", false, outputFn("ignored")),
				],
			}),
			itemFn("one"),
			itemFn("two"),
		);
		const { chains } = readItemChainsFn(items, "source");
		expect(
			chains[0].steps.map(({ lineId, clockWeight }) => ({
				lineId,
				clockWeight,
			})),
		).toEqual([
			{
				lineId: "first",
				clockWeight: 1,
			},
			{
				lineId: "second",
				clockWeight: 3,
			},
		]);
		expect(new Set(chains[0].steps.map(({ path }) => path)).size).toBe(2);
		expect(chains[0].outcomes.filter(({ periodic }) => periodic)).toEqual([
			{
				itemId: "one",
				stop: "final",
				periodic: true,
				conditional: true,
			},
			{
				itemId: "two",
				stop: "final",
				periodic: true,
				conditional: true,
			},
		]);
	});

	it("retains early side drops while following the bear's last timed state", () => {
		const items = catalogFn(
			itemFn("bear", {
				merge: [
					mergeFn("honey", "eating"),
				],
			}),
			itemFn("honey"),
			itemFn("eating", {
				clock: clockFn("fed", "jar", "waste"),
			}),
			itemFn("fed", {
				clock: clockFn("waste"),
			}),
			itemFn("jar"),
			itemFn("waste"),
		);
		expect(finalIdsFn(readItemChainsFn(items, "bear"))).toEqual([
			"waste",
			"jar",
		]);
	});
});
