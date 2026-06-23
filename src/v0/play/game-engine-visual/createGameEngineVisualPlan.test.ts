import { describe, expect, it } from "vitest";
import { rebuildBoardView } from "~/v0/board/view/rebuildBoardView";
import { rebuildInventoryView } from "~/v0/inventory/view/rebuildInventoryView";
import type { GameEvent } from "~/v0/game/event/GameEventSchema";
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

		expect(plan.boardFeedbackRequests).toHaveLength(0);
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

	it("does not duplicate the direct board producer input drop animation", () => {
		const previousBoard = boardView([
			{
				id: "producer",
				itemId: "item:producer",
				state: {},
				x: 0,
				y: 0,
			},
			{
				id: "source",
				itemId: "item:twig",
				state: {},
				x: 1,
				y: 0,
			},
		]);

		const plan = createGameEngineVisualPlan({
			currentBoard: boardView([
				{
					id: "producer",
					itemId: "item:producer",
					state: {},
					x: 0,
					y: 0,
				},
			]),
			currentInventory: undefined,
			events: [
				{
					from: {
						itemInstanceId: "source",
						kind: "board",
					},
					itemId: "item:twig",
					reason: "producer-input-store",
					type: "item.consumed",
				},
				{
					itemId: "item:twig",
					nextQuantity: 1,
					previousQuantity: 0,
					producerItemInstanceId: "producer",
					productId: "product:test",
					quantity: 1,
					storedAtMs: 1,
					type: "producer_input.stored",
				},
			] satisfies GameEvent[],
			previousBoard,
		});

		expect(plan.boardTransientTilePlans).toHaveLength(0);
		expect(plan.boardFeedbackRequests).toHaveLength(1);
		expect(plan.boardFeedbackRequests[0]).toMatchObject({
			feedback: {
				kind: "bounce",
			},
			tileId: "producer",
		});
	});

	it("maps auto-filled board producer input storage to a transient tile flying into the producer", () => {
		const previousBoard = boardView([
			{
				id: "producer",
				itemId: "item:producer",
				state: {},
				x: 0,
				y: 0,
			},
			{
				id: "source",
				itemId: "item:twig",
				state: {},
				x: 1,
				y: 0,
			},
		]);

		const plan = createGameEngineVisualPlan({
			currentBoard: boardView([
				{
					id: "producer",
					itemId: "item:producer",
					state: {},
					x: 0,
					y: 0,
				},
			]),
			currentInventory: undefined,
			events: [
				{
					from: {
						itemInstanceId: "source",
						kind: "board",
					},
					itemId: "item:twig",
					reason: "producer-input-auto-fill",
					type: "item.consumed",
				},
				{
					itemId: "item:twig",
					nextQuantity: 1,
					previousQuantity: 0,
					producerItemInstanceId: "producer",
					productId: "product:test",
					quantity: 1,
					storedAtMs: 1,
					type: "producer_input.stored",
				},
				{
					completesAtMs: 1000,
					jobId: "job:1",
					producerItemInstanceId: "producer",
					productId: "product:test",
					startedAtMs: 1,
					type: "product.started",
				},
			] satisfies GameEvent[],
			previousBoard,
		});

		expect(plan.boardFeedbackRequests).toHaveLength(1);
		expect(plan.boardFeedbackRequests[0]).toMatchObject({
			feedback: {
				kind: "bounce",
			},
			tileId: "producer",
		});
		expect(plan.boardTransientTilePlans).toHaveLength(1);
		expect(plan.boardTransientTilePlans[0]).toMatchObject({
			request: {
				exit: {
					kind: "fly-to-tile",
					toTileId: "producer",
				},
			},
			tile: {
				itemId: "item:twig",
				slotId: "1:0",
			},
		});
	});

	it("maps auto-filled board stash input to a transient tile flying into the stash", () => {
		const previousBoard = boardView([
			{
				id: "stash",
				itemId: "item:chest",
				state: {},
				x: 0,
				y: 0,
			},
			{
				id: "source",
				itemId: "item:key",
				state: {},
				x: 1,
				y: 0,
			},
		]);

		const plan = createGameEngineVisualPlan({
			currentBoard: boardView([
				{
					id: "stash",
					itemId: "item:chest",
					state: {},
					x: 0,
					y: 0,
				},
			]),
			currentInventory: undefined,
			events: [
				{
					from: {
						itemInstanceId: "source",
						kind: "board",
					},
					itemId: "item:key",
					reason: "stash-input-auto-fill",
					type: "item.consumed",
				},
				{
					openedAtMs: 1,
					remainingCharges: 0,
					stashId: "stash:chest",
					stashItemInstanceId: "stash",
					type: "stash.opened",
				},
			] satisfies GameEvent[],
			previousBoard,
		});

		expect(plan.boardFeedbackRequests).toHaveLength(1);
		expect(plan.boardFeedbackRequests[0]).toMatchObject({
			feedback: {
				kind: "bounce",
			},
			tileId: "stash",
		});
		expect(plan.boardTransientTilePlans).toHaveLength(1);
		expect(plan.boardTransientTilePlans[0]).toMatchObject({
			request: {
				exit: {
					kind: "fly-to-tile",
					toTileId: "stash",
				},
			},
			tile: {
				itemId: "item:key",
				slotId: "1:0",
			},
		});
	});

	it("does not animate manually dragged stash inputs twice", () => {
		const previousBoard = boardView([
			{
				id: "stash",
				itemId: "item:chest",
				state: {},
				x: 0,
				y: 0,
			},
			{
				id: "source",
				itemId: "item:key",
				state: {},
				x: 1,
				y: 0,
			},
		]);

		const plan = createGameEngineVisualPlan({
			currentBoard: boardView([
				{
					id: "stash",
					itemId: "item:chest",
					state: {},
					x: 0,
					y: 0,
				},
			]),
			currentInventory: undefined,
			events: [
				{
					from: {
						itemInstanceId: "source",
						kind: "board",
					},
					itemId: "item:key",
					reason: "stash-input",
					type: "item.consumed",
				},
				{
					openedAtMs: 1,
					remainingCharges: 0,
					stashId: "stash:chest",
					stashItemInstanceId: "stash",
					type: "stash.opened",
				},
			] satisfies GameEvent[],
			previousBoard,
		});

		expect(plan.boardFeedbackRequests).toHaveLength(0);
		expect(plan.boardTransientTilePlans).toHaveLength(0);
	});

	it("maps product completion to producer bounce feedback", () => {
		const plan = createGameEngineVisualPlan({
			currentBoard: boardView([
				{
					id: "producer",
					itemId: "item:producer",
					state: {},
					x: 0,
					y: 0,
				},
			]),
			currentInventory: undefined,
			events: [
				{
					completedAtMs: 1000,
					jobId: "job:1",
					producerItemInstanceId: "producer",
					productId: "product:test",
					type: "product.completed",
				},
			] satisfies GameEvent[],
			previousBoard: boardView([
				{
					id: "producer",
					itemId: "item:producer",
					state: {},
					x: 0,
					y: 0,
				},
			]),
		});

		expect(plan.boardFeedbackRequests).toHaveLength(1);
		expect(plan.boardFeedbackRequests[0]).toMatchObject({
			feedback: {
				kind: "bounce",
			},
			tileId: "producer",
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
