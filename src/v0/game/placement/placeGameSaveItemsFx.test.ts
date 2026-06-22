import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { createInitialGameSaveFx } from "~/v0/game/save/createInitialGameSaveFx";
import { placeGameSaveItemsFx } from "~/v0/game/placement/placeGameSaveItemsFx";
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
			expect.objectContaining({
				itemId: "item:twig",
				x: 1,
				y: 0,
			}),
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

	it("does not stack stateless output into an inventory instance slot", () => {
		const config = createEngineTestConfig({
			game: {
				id: "game:test",
				inventory: {
					slots: 2,
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
			id: "item-instance:2",
			itemId: "item:twig",
			kind: "instance",
		};

		const result = runPlacement({
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

		expect(result.save.inventory.slots).toEqual([
			{
				id: "item-instance:2",
				itemId: "item:twig",
				kind: "instance",
			},
			{
				itemId: "item:twig",
				quantity: 1,
			},
		]);
	});

	it("places inventory-only output directly into inventory", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			items: {
				...baseConfig.items,
				"item:twig": {
					...baseConfig.items["item:twig"],
					storage: "inventory",
				},
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
					quantity: 1,
					reason: "debug",
				},
			],
			nowMs: 10,
			save,
		});

		expect(Object.values(result.save.board.items).map((item) => item.itemId)).toEqual([
			"item:producer",
		]);
		expect(result.save.inventory.slots[0]).toEqual({
			itemId: "item:twig",
			quantity: 1,
		});
		expect(result.events).toMatchObject([
			{
				to: {
					kind: "inventory",
				},
				type: "item.created",
			},
		]);
	});

	it("does not hide board-only output in inventory after the board fills", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			items: {
				...baseConfig.items,
				"item:twig": {
					...baseConfig.items["item:twig"],
					storage: "board",
				},
			},
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
				reason: "board:full",
			},
		});
		expect(save.inventory.slots).toEqual([
			null,
		]);
	});

	it("rejects placement when the new item is exclusive to owned items", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			items: {
				...baseConfig.items,
				"item:plank": {
					...baseConfig.items["item:plank"],
					exclusiveToIds: [
						"item:twig",
					],
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.inventory.slots[0] = {
			itemId: "item:twig",
			quantity: 1,
		};

		const result = runPlacementEither({
			config,
			items: [
				{
					itemId: "item:plank",
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
				reason: "exclusive:conflict",
			},
		});
	});

	it("rejects placement when owned items are exclusive to the new item", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			items: {
				...baseConfig.items,
				"item:twig": {
					...baseConfig.items["item:twig"],
					exclusiveToIds: [
						"item:plank",
					],
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.inventory.slots[0] = {
			itemId: "item:twig",
			quantity: 1,
		};

		const result = runPlacementEither({
			config,
			items: [
				{
					itemId: "item:plank",
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
				reason: "exclusive:conflict",
			},
		});
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
		expect(Object.keys(save.board.items)).toEqual([
			"item-instance:1",
		]);
		expect(save.inventory.slots[0]).toEqual({
			itemId: "item:twig",
			quantity: 3,
		});
	});
});
