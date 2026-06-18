import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { createInitialGameSaveFx } from "~/v0/game/engine/fx/createInitialGameSaveFx";
import { placeGameSaveItemsFx } from "~/v0/game/engine/fx/placeGameSaveItemsFx";
import { createEngineTestConfig } from "~/v0/game/engine/test/createEngineTestConfig";

const runInitialSave = (props: createInitialGameSaveFx.Props) =>
	Effect.runSync(createInitialGameSaveFx(props));
const runPlacement = (props: placeGameSaveItemsFx.Props) =>
	Effect.runSync(placeGameSaveItemsFx(props));
const runPlacementEither = (props: placeGameSaveItemsFx.Props) =>
	Effect.runSync(Effect.either(placeGameSaveItemsFx(props)));

describe("placeGameSaveItemsFx", () => {
	it("places loose board tiles first and stacks the remainder in inventory", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const result = runPlacement({
			config,
			items: [
				{
					itemId: "item:twig",
					quantity: 4,
					reason: "debug",
				},
			],
			nowMs: 10,
			save,
		});

		expect(result.type).toBe("placed");
		if (result.type !== "placed") {
			return;
		}

		expect(Object.values(result.save.board.items)).toEqual([
			{
				id: "item-instance:1",
				itemId: "item:producer",
				x: 0,
				y: 0,
			},
			{
				id: "item-instance:2",
				itemId: "item:twig",
				x: 1,
				y: 0,
			},
		]);
		expect(result.save.inventory.slots).toEqual([
			{
				itemId: "item:twig",
				quantity: 3,
			},
			null,
		]);
		expect(
			result.events.map((event) => {
				if (event.type !== "item.created") {
					return null;
				}

				return event.to.kind;
			}),
		).toEqual([
			"board",
			"inventory",
		]);
	});

	it("places board output near a provided seed cell before using global scan order", () => {
		const config = createEngineTestConfig({
			game: {
				id: "game:test",
				inventory: {
					slots: 1,
				},
				board: {
					height: 3,
					width: 3,
				},
				title: "Test",
			},
			startingState: {
				board: [
					{
						itemId: "item:producer",
						x: 1,
						y: 1,
					},
				],
				inventory: [],
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const result = runPlacement({
			config,
			items: [
				{
					itemId: "item:twig",
					quantity: 3,
					reason: "debug",
				},
			],
			nowMs: 10,
			save,
			seedCell: {
				x: 1,
				y: 1,
			},
		});

		expect(result.type).toBe("placed");
		if (result.type !== "placed") {
			return;
		}

		expect(
			result.events.map((event) => {
				if (event.type !== "item.created" || event.to.kind !== "board") {
					return null;
				}

				return {
					x: event.to.x,
					y: event.to.y,
				};
			}),
		).toEqual([
			{
				x: 1,
				y: 0,
			},
			{
				x: 0,
				y: 1,
			},
			{
				x: 2,
				y: 1,
			},
		]);
	});

	it("keeps placement atomic when board and inventory cannot fit the whole output", () => {
		const config = createEngineTestConfig({
			game: {
				id: "game:test",
				inventory: {
					slots: 1,
				},
				board: {
					height: 1,
					width: 1,
				},
				title: "Test",
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.inventory.slots[0] = {
			itemId: "item:twig",
			quantity: 3,
		};

		const result = runPlacementEither({
			config,
			items: [
				{
					itemId: "item:twig",
					quantity: 1,
					reason: "debug",
				},
			],
			nowMs: 10,
			save,
		});

		expect(result).toMatchObject({
			_tag: "Left",
			left: {
				_tag: "GamePlacementFailed",
				message: "Placement target is full.",
				reason: "board:full",
			},
		});
		expect(save.nextItemInstanceIndex).toBe(2);
		expect(Object.keys(save.board.items)).toEqual([
			"item-instance:1",
		]);
		expect(save.inventory.slots[0]).toEqual({
			itemId: "item:twig",
			quantity: 3,
		});
	});
});
