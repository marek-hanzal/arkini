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

	it("spills output to inventory after item board maxCount is reached", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			items: {
				...baseConfig.items,
				"item:twig": {
					...baseConfig.items["item:twig"],
					maxCount: 1,
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
					quantity: 2,
					reason: "debug",
				},
			],
			nowMs: 10,
			save,
		});

		expect(
			Object.values(result.save.board.items).filter((item) => item.itemId === "item:twig"),
		).toHaveLength(1);
		expect(result.save.inventory.slots[0]).toEqual({
			itemId: "item:twig",
			quantity: 1,
		});
	});

	it("rejects board-only output after item board maxCount is reached", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			items: {
				...baseConfig.items,
				"item:twig": {
					...baseConfig.items["item:twig"],
					maxCount: 1,
					storage: "board",
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.board.items["item-instance:2"] = {
			id: "item-instance:2",
			itemId: "item:twig",
			x: 1,
			y: 0,
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
				reason: "board:max-count",
			},
		});
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

	it("skips locally blocked board cells instead of failing the whole placement", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			effects: {
				"effect:block-near-producer": {
					name: "Block near producer",
					operations: [
						{
							kind: "item.blockCreate",
							target: {
								items: {
									ids: [
										"item:plank",
									],
								},
							},
						},
					],
					radius: 1,
					scope: "local",
				},
			},
			game: {
				id: "game:test",
				inventory: {
					slots: 1,
				},
				board: {
					height: 1,
					width: 3,
				},
				title: "Test",
			},
			items: {
				...baseConfig.items,
				"item:producer": {
					...baseConfig.items["item:producer"],
					passiveEffectIds: [
						"effect:block-near-producer",
					],
				},
				"item:plank": {
					...baseConfig.items["item:plank"],
					storage: "board",
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
					itemId: "item:plank",
					quantity: 1,
					reason: "debug",
				},
			],
			nowMs: 10,
			save,
		});

		expect(result.events).toMatchObject([
			{
				itemId: "item:plank",
				to: {
					kind: "board",
					x: 2,
					y: 0,
				},
				type: "item.created",
			},
		]);
	});

	it("rejects placement when an effect blocks item creation", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig();
		config.effects["effect:block-plank"] = {
			name: "Block plank",
			operations: [
				{
					kind: "item.blockCreate",
					reason: "Plank creation is blocked.",
					target: {
						items: {
							ids: [
								"item:plank",
							],
						},
					},
				},
			],
			scope: "global",
		};
		config.items["item:producer"] = {
			...baseConfig.items["item:producer"],
			passiveEffectIds: [
				"effect:block-plank",
			],
		};
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

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
				reason: "effect:block-create",
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
