import { Effect, Option } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/engine/game/fx/useGameFx";
import { isGridRuntimeItemFx } from "~/engine/runtime/read/isGridRuntimeItemFx";
import { readDropItemPreviewFx } from "~/engine/runtime/read/readDropItemPreviewFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import { dropItemFx } from "~/engine/runtime/write/dropItemFx";
import { startFx } from "~/engine/start/write/startFx";
import { readDemoGameConfigSource } from "~/../test/schema/support/readArkiniGameConfigSource";

describe("multi-slot demo content", () => {
	it("compiles the representative footprint set and storage fixtures", async () => {
		const config = await readDemoGameConfigSource();

		expect(config.items["item:water"]?.footprint).toEqual({
			width: 1,
			height: 1,
		});
		expect(config.items["item:survey-peg"]?.footprint).toEqual({
			width: 1,
			height: 1,
		});
		expect(config.items["item:tree"]?.footprint).toEqual({
			width: 2,
			height: 2,
		});
		expect(config.items["item:output-yard"]?.footprint).toEqual({
			width: 2,
			height: 3,
		});
		expect(config.items["item:beam"]?.footprint).toEqual({
			width: 3,
			height: 1,
		});
		expect(config.items["item:landmark"]?.footprint).toEqual({
			width: 3,
			height: 3,
		});
		expect(config.items["item:pallet"]).toMatchObject({
			footprint: {
				width: 2,
				height: 2,
			},
			maxStackSize: 4,
		});
		expect(config.items["item:landmark"]?.maxStackSize).toBe(1);
		expect(config.start.inventory).toContainEqual({
			itemId: "item:pallet",
			quantity: 2,
		});
		expect(config.start.toolbar).toContainEqual({
			itemId: "item:survey-peg",
			position: {
				x: 3,
				y: 0,
			},
		});
	});

	it("authors the blocked completion, merge fallback, and bounded collision route", async () => {
		const config = await readDemoGameConfigSource();
		const board = config.start.board;
		const yard = config.items["item:output-yard"];
		const water = config.items["item:water"];
		const occupied = new Set(
			board.flatMap((placement) => {
				const footprint = config.items[placement.itemId]?.footprint;
				if (footprint === undefined) throw new Error(`Missing item ${placement.itemId}`);

				return Array.from(
					{
						length: footprint.width * footprint.height,
					},
					(_, index) => {
						const x = placement.x + (index % footprint.width);
						const y = placement.y + Math.floor(index / footprint.width);
						return `${x}:${y}`;
					},
				);
			}),
		);

		expect(yard?.type).toBe("producer");
		if (yard?.type !== "producer") throw new Error("Expected the Output Yard producer");
		expect(yard.lines[0]?.rules).toContainEqual({
			type: "enable",
			when: [
				{
					type: "exists",
					query: {
						scope: "board",
						distance: "close",
						selector: {
							type: "item",
							itemId: "item:survey-peg",
						},
					},
				},
			],
		});
		expect(yard.lines[0]?.output?.set[0]?.roll[0]?.drop[0]).toMatchObject({
			itemId: "item:landmark",
			quantity: {
				type: "value",
				value: 1,
			},
		});
		expect(water?.merge?.[0]).toMatchObject({
			target: {
				type: "item",
				itemId: "item:tree",
			},
			action: "consume",
			effect: "replace",
			result: "item:double-tree",
		});
		expect(board).toEqual(
			expect.arrayContaining([
				{
					itemId: "item:beam",
					x: 0,
					y: 5,
					space: 0,
				},
				{
					itemId: "item:survey-peg",
					x: 2,
					y: 3,
					space: 0,
				},
				{
					itemId: "item:survey-peg",
					x: 3,
					y: 3,
					space: 0,
				},
				{
					itemId: "item:survey-peg",
					x: 6,
					y: 0,
					space: 0,
				},
			]),
		);

		const freeLandmarkAnchors = Array.from(
			{
				length: (config.meta.board.width - 2) * (config.meta.board.height - 2),
			},
			(_, index) => ({
				x: index % (config.meta.board.width - 2),
				y: Math.floor(index / (config.meta.board.width - 2)),
			}),
		).filter(({ x, y }) =>
			Array.from(
				{
					length: 9,
				},
				(_, index) => `${x + (index % 3)}:${y + Math.floor(index / 3)}`,
			).every((location) => !occupied.has(location)),
		);

		expect(freeLandmarkAnchors).toEqual([]);
		expect(
			[
				"4:0",
				"5:0",
				"6:0",
			].filter((location) => occupied.has(location)),
		).toEqual([
			"4:0",
			"5:0",
			"6:0",
		]);
		expect(
			[
				"1:3",
				"2:3",
				"3:3",
			].filter((location) => occupied.has(location)),
		).toEqual([
			"2:3",
			"3:3",
		]);
	});

	it("commits the authored beam drop through the bounded relocation route", async () => {
		const config = await readDemoGameConfigSource();
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* startFx();
				const before = yield* readRuntimeFx();
				const beamRuntime = before.items.find(({ item }) => item.id === "item:beam");
				const targetRuntime = before.items.find(
					({ item, location }) =>
						item.id === "item:survey-peg" &&
						location.scope === "board" &&
						location.position.x === 2 &&
						location.position.y === 3,
				);
				const beam =
					beamRuntime === undefined
						? undefined
						: Option.getOrUndefined(yield* isGridRuntimeItemFx(beamRuntime));
				const target =
					targetRuntime === undefined
						? undefined
						: Option.getOrUndefined(yield* isGridRuntimeItemFx(targetRuntime));
				if (beam === undefined || target === undefined) {
					return yield* Effect.die(
						new Error("Expected the authored beam and first collision peg."),
					);
				}
				const command = {
					sourceItemId: beam.id,
					sourceLocation: beam.location,
					sourceRevision: beam.revision,
					target: {
						hitLocation: target.location,
						kind: "slot" as const,
						location: {
							scope: "board" as const,
							space: 0,
							position: {
								x: 1,
								y: 3,
							},
						},
						occupant: {
							itemId: target.id,
							revision: target.revision,
						},
					},
				};
				const preview = yield* readDropItemPreviewFx(command);
				const committed =
					"collisions" in preview
						? yield* dropItemFx({
								...command,
								target: {
									...command.target,
									expectedCollisions: preview.collisions,
								},
							})
						: yield* dropItemFx(command);
				return {
					after: yield* readRuntimeFx(),
					beamId: beam.id,
					committed,
					preview,
				};
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(result.preview).toMatchObject({
			kind: "swap",
			collisions: [
				expect.objectContaining({}),
				expect.objectContaining({}),
			],
		});
		expect(result.committed).toMatchObject({
			kind: "swap",
			relocations: [
				expect.objectContaining({}),
				expect.objectContaining({}),
			],
		});
		expect(result.after.items.find(({ id }) => id === result.beamId)?.location).toEqual({
			scope: "board",
			space: 0,
			position: {
				x: 1,
				y: 3,
			},
		});
	});
});
