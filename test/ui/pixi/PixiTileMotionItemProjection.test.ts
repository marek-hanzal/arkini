import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import type { TileMotionCue } from "~/bridge/tile/motion/TileMotionCue";
import { projectPixiTileMotionItemFx } from "~/ui/pixi/motion/projectPixiTileMotionItemFx";
import { readPixiTileQuantityPresentationFx } from "~/ui/pixi/motion/readPixiTileQuantityPresentationFx";

const item = (itemType: TileActorItem["itemType"]): TileActorItem => ({
	activityEffect: false,
	badgeCount: 8,
	id: "runtime:item",
	itemId: "item",
	itemType,
	location: {
		position: {
			x: 0,
			y: 0,
		},
		scope: "inventory",
	},
	primaryAction: {
		kind: "none",
	},
	quantity: 8,
	revision: "revision:item",
	running: false,
	sourceUrl: "resource:item",
	title: "Item",
});

describe("Pixi tile motion item projection", () => {
	it("projects an ordinary stack quantity and badge atomically", () => {
		expect(
			Effect.runSync(
				projectPixiTileMotionItemFx(item("simple"), {
					kind: "subtract",
					quantity: 7,
				}),
			),
		).toMatchObject({
			badgeCount: undefined,
			quantity: 1,
		});
	});

	it("keeps a deposit charge badge independent from its presented quantity", () => {
		expect(
			Effect.runSync(
				projectPixiTileMotionItemFx(item("deposit"), {
					kind: "exact",
					quantity: 3,
				}),
			),
		).toMatchObject({
			badgeCount: 8,
			quantity: 3,
		});
	});

	it("does not reveal an older stack through a later pending input", () => {
		const location = item("simple").location;
		const stack = {
			canonicalItemId: "item",
			eventIndex: 0,
			kind: "stack",
			originActorId: "runtime:producer",
			originLocation: location,
			quantity: 1,
			sequence: 1,
			staggerIndex: 0,
			targetActorId: "runtime:item",
			targetLocation: location,
		} satisfies TileMotionCue;
		const input = {
			canonicalItemId: "item",
			eventIndex: 0,
			kind: "input",
			originActorId: "runtime:item",
			originLocation: location,
			previousQuantity: 6,
			resultingQuantity: 4,
			sequence: 2,
			sourceActorId: "runtime:item",
			staggerIndex: 0,
			storedQuantity: 2,
			targetActorId: "runtime:owner",
			targetLocation: location,
		} satisfies TileMotionCue;
		const read = (
			cues: ReadonlyArray<TileMotionCue>,
			revealedInputCueKeys: ReadonlySet<string> = new Set(),
		) =>
			Effect.runSync(
				readPixiTileQuantityPresentationFx({
					cues,
					readTargetRoute: (actorId, targetLocation) => ({
						actorId,
						location: targetLocation,
						redirected: false,
					}),
					revealedInputCueKeys,
				}),
			);

		expect(
			read([
				stack,
				input,
			]),
		).toEqual(
			new Map([
				[
					"runtime:item",
					{
						kind: "exact",
						quantity: 5,
					},
				],
			]),
		);
		expect(
			read([
				input,
			]),
		).toEqual(
			new Map([
				[
					"runtime:item",
					{
						kind: "exact",
						quantity: 6,
					},
				],
			]),
		);
		expect(
			read(
				[
					input,
				],
				new Set([
					"2:0",
				]),
			),
		).toEqual(
			new Map([
				[
					"runtime:item",
					{
						kind: "exact",
						quantity: 4,
					},
				],
			]),
		);
	});
});
