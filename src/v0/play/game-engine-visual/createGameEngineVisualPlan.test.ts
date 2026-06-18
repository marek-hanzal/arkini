import { describe, expect, it } from "vitest";
import { rebuildBoardView } from "~/v0/board/view/rebuildBoardView";
import { rebuildInventoryView } from "~/v0/inventory/view/rebuildInventoryView";
import type { GameEvent } from "~/v0/game/engine/model/GameEventSchema";
import { createGameEngineVisualPlan } from "~/v0/play/game-engine-visual/createGameEngineVisualPlan";

const boardView = (items: Parameters<typeof rebuildBoardView>[0]) => rebuildBoardView(items);

const emptyInventory = () => rebuildInventoryView([]);

describe("createGameEngineVisualPlan", () => {
	it("maps board item creation directly from domain events to sequenced board enter motion", () => {
		const currentBoard = boardView([
			{
				id: "spawned:1",
				itemId: "item:twig",
				state: {},
				x: 1,
				y: 0,
			},
			{
				id: "spawned:2",
				itemId: "item:stone",
				state: {},
				x: 2,
				y: 0,
			},
		]);

		const plan = createGameEngineVisualPlan({
			currentBoard,
			currentInventory: emptyInventory(),
			events: [
				{
					itemId: "item:twig",
					originItemInstanceId: "producer:1",
					reason: "product-output",
					to: {
						itemInstanceId: "spawned:1",
						kind: "board",
						x: 1,
						y: 0,
					},
					type: "item.created",
				},
				{
					itemId: "item:stone",
					originItemInstanceId: "producer:1",
					reason: "product-output",
					to: {
						itemInstanceId: "spawned:2",
						kind: "board",
						x: 2,
						y: 0,
					},
					type: "item.created",
				},
			] satisfies GameEvent[],
			previousBoard: boardView([]),
		});

		expect(plan.boardEnterRequests).toHaveLength(2);
		expect(plan.boardEnterRequests[0]).toMatchObject({
			enter: {
				fromTileId: "producer:1",
				groupId: "engine:product-output:producer:1",
				kind: "spawn-from-tile",
				sequenceIndex: 0,
			},
			tileId: "spawned:1",
		});
		expect(plan.boardEnterRequests[1]).toMatchObject({
			enter: {
				fromTileId: "producer:1",
				groupId: "engine:product-output:producer:1",
				kind: "spawn-from-tile",
				sequenceIndex: 1,
			},
			tileId: "spawned:2",
		});
	});

	it("maps merge source consumption plus result replacement to one merge motion plan", () => {
		const previousBoard = boardView([
			{
				id: "source",
				itemId: "item:twig",
				state: {},
				x: 0,
				y: 0,
			},
			{
				id: "target",
				itemId: "item:twig",
				state: {},
				x: 1,
				y: 0,
			},
		]);
		const currentBoard = boardView([
			{
				id: "target",
				itemId: "item:branch",
				state: {},
				x: 1,
				y: 0,
			},
		]);

		const plan = createGameEngineVisualPlan({
			currentBoard,
			currentInventory: undefined,
			events: [
				{
					from: {
						itemInstanceId: "source",
						kind: "board",
					},
					itemId: "item:twig",
					reason: "merge-source",
					type: "item.consumed",
				},
				{
					fromItemId: "item:twig",
					itemInstanceId: "target",
					reason: "merge-result",
					replacedAtMs: 1,
					toItemId: "item:branch",
					type: "item.replaced",
				},
			] satisfies GameEvent[],
			previousBoard,
		});

		expect(plan.boardTransientTilePlans).toHaveLength(2);
		expect(plan.boardTransientTilePlans.map((entry) => entry.request.exit?.kind)).toEqual([
			"merge-out",
			"merge-out",
		]);
		expect(plan.boardEnterRequests).toHaveLength(1);
		expect(plan.boardEnterRequests[0]).toMatchObject({
			enter: {
				groupId: "engine:merge:source:target",
				kind: "merge-in",
			},
			tileId: "target",
		});
	});

	it("maps craft result replacement to replace crossfade motion", () => {
		const previousBoard = boardView([
			{
				id: "target",
				itemId: "item:sapling",
				state: {},
				x: 1,
				y: 0,
			},
		]);
		const currentBoard = boardView([
			{
				id: "target",
				itemId: "item:tree",
				state: {},
				x: 1,
				y: 0,
			},
		]);

		const plan = createGameEngineVisualPlan({
			currentBoard,
			currentInventory: undefined,
			events: [
				{
					fromItemId: "item:sapling",
					itemInstanceId: "target",
					reason: "craft-result",
					replacedAtMs: 1,
					toItemId: "item:tree",
					type: "item.replaced",
				},
			] satisfies GameEvent[],
			previousBoard,
		});

		expect(plan.boardTransientTilePlans).toHaveLength(1);
		expect(plan.boardTransientTilePlans[0]).toMatchObject({
			request: {
				exit: {
					groupId: "engine:craft-result:target",
					kind: "replace-out",
				},
			},
			tile: {
				itemId: "item:sapling",
				slotId: "1:0",
			},
		});
		expect(plan.boardEnterRequests[0]).toMatchObject({
			enter: {
				groupId: "engine:craft-result:target",
				kind: "replace-in",
			},
			tileId: "target",
		});
	});

	it("accounts for inventory creation as an explicit no-motion domain event", () => {
		const plan = createGameEngineVisualPlan({
			currentBoard: boardView([]),
			currentInventory: rebuildInventoryView([
				{
					slotIndex: 0,
					stack: {
						id: "stack:0",
						itemId: "item:twig",
						quantity: 2,
						state: {},
						stateJson: "{}",
						stateful: false,
					},
				},
			]),
			events: [
				{
					itemId: "item:twig",
					reason: "stash-output",
					to: {
						kind: "inventory",
						nextQuantity: 2,
						previousQuantity: 1,
						quantity: 1,
						slotIndex: 0,
					},
					type: "item.created",
				},
			] satisfies GameEvent[],
			previousBoard: boardView([]),
		});

		expect(plan.boardEnterRequests).toHaveLength(0);
		expect(plan.boardTransientTilePlans).toHaveLength(0);
		expect(plan.inventoryEnterRequests).toHaveLength(0);
	});
});
