import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { resolveOneHopOutputCapacityFx } from "~/production-job/fx/resolveOneHopOutputCapacityFx";
import type { LineSchema } from "~/production-line/schema/LineSchema";
import { blueprintConfig } from "~test/production-job/fx/completeJobTransitionFx.blueprint.test/config";
import { sourceLine } from "~test/production-job/fx/completeJobTransitionFx.blueprint.test/fixture";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { useGameFx } from "~test/support/useGameFx";

const intermediate = blueprintConfig.items["blueprint:plain"];
const safeIntermediate = blueprintConfig.items["blueprint:output"];
if (intermediate.type !== "common" || safeIntermediate.type !== "common") {
	throw new Error("Expected Common line owners.");
}
const blockedLine = intermediate.lines[0];
const safeLine = {
	...safeIntermediate.lines[0],
	id: "line:safe-alternative",
};

const checkCapacity = (type: "common" | "clock", lines: LineSchema.Type[]) => {
	const config = GameConfigSchema.parse({
		...blueprintConfig,
		items: {
			...blueprintConfig.items,
			[intermediate.id]: {
				...intermediate,
				type,
				lines,
				...(type === "clock"
					? {
							intervalMs: 100,
						}
					: {}),
			},
		},
	});
	return Effect.runSync(
		Effect.gen(function* () {
			yield* spawnItemFx({
				id: "runtime:full-target",
				itemId: "item:target",
				location: {
					scope: "board",
					space: 0,
					position: {
						x: 0,
						y: 0,
					},
				},
				quantity: 1,
			});
			return yield* resolveOneHopOutputCapacityFx({
				line: sourceLine("line:producer:blueprint-source"),
				runtime: yield* readRuntimeFx(),
			});
		}).pipe(
			useGameFx({
				config,
			}),
		),
	);
};

describe("line check-ahead capacity", () => {
	it.each([
		"common",
		"clock",
	] as const)("checks marked %s lines and admits any marked viable alternative", (type) => {
		expect(
			checkCapacity(type, [
				blockedLine,
			]),
		).toMatchObject({
			intermediateItemId: intermediate.id,
			itemId: "item:target",
		});
		expect(
			checkCapacity(type, [
				blockedLine,
				safeLine,
			]),
		).toBeUndefined();
		expect(
			checkCapacity(type, [
				blockedLine,
				{
					...safeLine,
					ahead: undefined,
				},
			]),
		).toMatchObject({
			itemId: "item:target",
		});
	});

	it("ignores unmarked, hidden, and disabled lines without using them as escape routes", () => {
		for (const excluded of [
			{
				ahead: undefined,
			},
			{
				ahead: false,
			},
			{
				show: false,
			},
			{
				enable: false,
			},
		]) {
			expect(
				checkCapacity("common", [
					{
						...blockedLine,
						...excluded,
					},
				]),
			).toBeUndefined();
			expect(
				checkCapacity("common", [
					blockedLine,
					{
						...safeLine,
						...excluded,
					},
				]),
			).toMatchObject({
				itemId: "item:target",
			});
		}
	});
});
