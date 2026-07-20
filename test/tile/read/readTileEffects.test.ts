import { describe, expect, it } from "vitest";

import { readTileEffects } from "~/engine/tile/read/readTileEffects";
import { lineRunRuntime } from "~test/line/fx/run/support/lineRunTestRuntime";

const workshopId = "runtime:workshop";
const permitId = "runtime:permit";

describe("readTileEffects", () => {
	it("reads incoming conditions for line owners with current activity and matches", () => {
		const runtime = lineRunRuntime({
			permit: true,
			booster: true,
		});
		const effects = readTileEffects({
			itemId: workshopId,
			runtime,
		});
		expect(effects.kind).toBe("available");
		if (effects.kind !== "available") throw new Error("Expected available tile effects.");
		expect(effects.incoming.map((effect) => effect.ruleType)).toEqual([
			"show",
			"hide",
			"enable",
			"disable",
			"runtime:multiplier",
		]);
		expect(
			effects.incoming.map((effect) => ({
				ruleType: effect.ruleType,
				active: effect.active,
				matchedQuantity: effect.matchedQuantity,
				matches: effect.matchedItems.map((item) => item.title),
			})),
		).toEqual([
			{
				ruleType: "show",
				active: true,
				matchedQuantity: 1,
				matches: [
					"permit",
				],
			},
			{
				ruleType: "hide",
				active: false,
				matchedQuantity: 0,
				matches: [],
			},
			{
				ruleType: "enable",
				active: true,
				matchedQuantity: 1,
				matches: [
					"permit",
				],
			},
			{
				ruleType: "disable",
				active: false,
				matchedQuantity: 0,
				matches: [],
			},
			{
				ruleType: "runtime:multiplier",
				active: true,
				matchedQuantity: 1,
				matches: [
					"booster",
				],
			},
		]);
		expect(effects.outgoing).toEqual([]);
	});

	it("reads outgoing conditions for supporting items that currently participate", () => {
		const runtime = lineRunRuntime({
			permit: true,
			booster: true,
		});
		const effects = readTileEffects({
			itemId: permitId,
			runtime,
		});
		expect(effects.kind).toBe("available");
		if (effects.kind !== "available") throw new Error("Expected available tile effects.");
		expect(effects.incoming).toEqual([]);
		expect(
			effects.outgoing.map((effect) => ({
				ruleType: effect.ruleType,
				ownerTitle: effect.ownerTitle,
				lineTitle: effect.lineTitle,
				active: effect.active,
			})),
		).toEqual([
			{
				ruleType: "show",
				ownerTitle: "workshop",
				lineTitle: "Build",
				active: true,
			},
			{
				ruleType: "enable",
				ownerTitle: "workshop",
				lineTitle: "Build",
				active: true,
			},
		]);
	});

	it("returns unavailable for stale runtime identities", () => {
		const runtime = lineRunRuntime({
			permit: true,
		});
		expect(
			readTileEffects({
				itemId: "runtime:missing",
				runtime,
			}),
		).toEqual({
			kind: "unavailable",
		});
	});
});
