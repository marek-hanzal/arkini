import { describe, expect, it } from "vitest";
import { rebuildBoardView } from "~/board/view/rebuildBoardView";
import { rebuildInventoryView } from "~/inventory/view/rebuildInventoryView";
import type { GameEvent } from "~/event/GameEventSchema";
import { createGameEngineVisualPlan } from "~/play/game-engine-visual/createGameEngineVisualPlan";

const boardView = (items: Parameters<typeof rebuildBoardView>[0]) => rebuildBoardView(items);

const emptyInventory = () => rebuildInventoryView([]);
const craftProgress = (inputProgress: number) => ({
	acceptedInputItemIds: [
		"item:water",
	],
	canAcceptInputs: true,
	complete: false,
	delivered: {
		"item:water": inputProgress > 0 ? 1 : 0,
	},
	durationMs: 1000,
	effectBlockReasons: [],
	id: "recipe:test",
	inputProgress,
	inputs: [
		{
			itemId: "item:water",
			quantity: 2,
		},
	],
	phase: "collecting_inputs" as const,
	progress: inputProgress,
	resultItemId: "item:tree",
	startRequirementsReady: true,
	timeProgress: 0,
});

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
					reason: "line-output",
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
					reason: "line-output",
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
				groupId: "engine:line-output:producer:1",
				kind: "spawn-from-tile",
				sequenceIndex: 0,
			},
			tileId: "spawned:1",
		});
		expect(plan.boardEnterRequests[1]).toMatchObject({
			enter: {
				fromTileId: "producer:1",
				groupId: "engine:line-output:producer:1",
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
					atMs: 1,
					toItemId: "item:branch",
					type: "item.replaced",
				},
			] satisfies GameEvent[],
			previousBoard,
		});

		expect(plan.boardTransientTilePlans).toHaveLength(2);
		expect(plan.boardTransientTilePlans.map((entry) => entry.request.exit?.kind)).toEqual([
			"flip-out",
			"flip-out",
		]);
		expect(plan.boardEnterRequests).toHaveLength(1);
		expect(plan.boardEnterRequests[0]).toMatchObject({
			enter: {
				durationMs: 1000,
				groupId: "engine:merge:source:target",
				kind: "flip-in",
			},
			tileId: "target",
		});
	});

	it("maps craft result replacement to replace crossfade motion", () => {
		const previousBoard = boardView([
			{
				id: "target",
				itemId: "item:seed",
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
					fromItemId: "item:seed",
					itemInstanceId: "target",
					reason: "craft-result",
					atMs: 1,
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
					durationMs: 1000,
					groupId: "engine:craft-result:target",
					kind: "flip-out",
				},
			},
			tile: {
				itemId: "item:seed",
				slotId: "1:0",
			},
		});
		expect(plan.boardEnterRequests[0]).toMatchObject({
			enter: {
				durationMs: 1000,
				groupId: "engine:craft-result:target",
				kind: "flip-in",
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
					itemInstanceId: "producer",
					lineId: "line:test",
					quantity: 1,
					atMs: 1,
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

	it("maps craft input storage to a flip stage update instead of plain bounce feedback", () => {
		const previousBoard = boardView([
			{
				craft: craftProgress(0),
				id: "blueprint",
				itemId: "item:blueprint-tree",
				state: {},
				x: 1,
				y: 0,
			},
		]);
		const currentBoard = boardView([
			{
				craft: craftProgress(0.5),
				id: "blueprint",
				itemId: "item:blueprint-tree",
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
					atMs: 123,
					itemId: "item:water",
					nextQuantity: 1,
					previousQuantity: 0,
					quantity: 1,
					recipeId: "recipe:test",
					targetItemInstanceId: "blueprint",
					type: "craft_input.stored",
				},
			] satisfies GameEvent[],
			previousBoard,
		});

		expect(plan.boardFeedbackRequests).toHaveLength(0);
		expect(plan.boardTransientTilePlans).toHaveLength(1);
		expect(plan.boardTransientTilePlans[0]).toMatchObject({
			request: {
				exit: {
					groupId: "engine:craft-stage:blueprint:item:water:123",
					kind: "flip-out",
				},
			},
			tile: {
				assetProgress: 0,
				itemId: "item:blueprint-tree",
				slotId: "1:0",
			},
		});
		expect(plan.boardEnterRequests[0]).toMatchObject({
			enter: {
				durationMs: 1000,
				groupId: "engine:craft-stage:blueprint:item:water:123",
				kind: "flip-in",
			},
			tileId: "blueprint",
		});
	});

	it("coalesces auto-filled craft stage updates into one target flip", () => {
		const previousBoard = boardView([
			{
				craft: craftProgress(0),
				id: "seed",
				itemId: "item:seed",
				state: {},
				x: 1,
				y: 0,
			},
		]);
		const currentBoard = boardView([
			{
				craft: craftProgress(1),
				id: "seed",
				itemId: "item:seed",
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
						kind: "inventory",
						nextQuantity: 1,
						previousQuantity: 2,
						quantity: 1,
						slotIndex: 0,
					},
					itemId: "item:water",
					reason: "craft-input-auto-fill",
					type: "item.consumed",
				},
				{
					atMs: 123,
					itemId: "item:water",
					nextQuantity: 1,
					previousQuantity: 0,
					quantity: 1,
					recipeId: "recipe:test",
					targetItemInstanceId: "seed",
					type: "craft_input.stored",
				},
				{
					from: {
						kind: "inventory",
						nextQuantity: 0,
						previousQuantity: 1,
						quantity: 1,
						slotIndex: 0,
					},
					itemId: "item:water",
					reason: "craft-input-auto-fill",
					type: "item.consumed",
				},
				{
					atMs: 123,
					itemId: "item:water",
					nextQuantity: 2,
					previousQuantity: 1,
					quantity: 1,
					recipeId: "recipe:test",
					targetItemInstanceId: "seed",
					type: "craft_input.stored",
				},
			] satisfies GameEvent[],
			previousBoard,
		});

		expect(plan.boardTransientTilePlans).toHaveLength(1);
		expect(plan.boardEnterRequests).toHaveLength(1);
		expect(plan.boardTransientTilePlans[0]).toMatchObject({
			request: {
				exit: {
					durationMs: 1000,
					groupId: "engine:craft-stage:seed:item:water:123",
					kind: "flip-out",
				},
			},
			tile: {
				assetProgress: 0,
				itemId: "item:seed",
				slotId: "1:0",
			},
		});
		expect(plan.boardEnterRequests[0]).toMatchObject({
			enter: {
				durationMs: 1000,
				groupId: "engine:craft-stage:seed:item:water:123",
				kind: "flip-in",
			},
			tileId: "seed",
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
					itemInstanceId: "producer",
					lineId: "line:test",
					quantity: 1,
					atMs: 1,
					type: "producer_input.stored",
				},
				{
					atMs: 1,
					readyAtMs: 1000,
					jobId: "job:1",
					itemInstanceId: "producer",
					lineId: "line:test",
					startAtMs: 1,
					type: "line.started",
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
					reason: "producer-input-auto-fill",
					type: "item.consumed",
				},
				{
					itemId: "item:key",
					nextQuantity: 1,
					previousQuantity: 0,
					quantity: 1,
					itemInstanceId: "stash",
					atMs: 1,
					type: "producer_input.stored",
					lineId: "line:stash",
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
					reason: "line-input",
					type: "item.consumed",
				},
				{
					itemId: "item:key",
					nextQuantity: 1,
					previousQuantity: 0,
					quantity: 1,
					itemInstanceId: "stash",
					atMs: 1,
					type: "producer_input.stored",
					lineId: "line:stash",
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
		expect(plan.boardTransientTilePlans).toHaveLength(0);
	});

	it("retains a depleted stash tile until the last board output starts", () => {
		const previousBoard = boardView([
			{
				id: "stash",
				itemId: "item:chest",
				state: {},
				x: 0,
				y: 0,
			},
		]);

		const plan = createGameEngineVisualPlan({
			currentBoard: boardView([
				{
					id: "output:1",
					itemId: "item:twig",
					state: {},
					x: 1,
					y: 0,
				},
				{
					id: "output:2",
					itemId: "item:stone",
					state: {},
					x: 2,
					y: 0,
				},
				{
					id: "output:3",
					itemId: "item:log",
					state: {},
					x: 3,
					y: 0,
				},
			]),
			currentInventory: undefined,
			events: [
				{
					itemId: "item:twig",
					originItemInstanceId: "stash",
					reason: "line-output",
					to: {
						itemInstanceId: "output:1",
						kind: "board",
						x: 1,
						y: 0,
					},
					type: "item.created",
				},
				{
					itemId: "item:stone",
					originItemInstanceId: "stash",
					reason: "line-output",
					to: {
						itemInstanceId: "output:2",
						kind: "board",
						x: 2,
						y: 0,
					},
					type: "item.created",
				},
				{
					itemId: "item:log",
					originItemInstanceId: "stash",
					reason: "line-output",
					to: {
						itemInstanceId: "output:3",
						kind: "board",
						x: 3,
						y: 0,
					},
					type: "item.created",
				},
				{
					itemId: "item:chest",
					itemInstanceId: "stash",
					reason: "producer-depleted",
					atMs: 1,
					type: "item.removed",
				},
			] satisfies GameEvent[],
			previousBoard,
		});

		expect(plan.boardEnterRequests).toHaveLength(3);
		expect(plan.boardTransientTilePlans).toHaveLength(1);

		const outputStartDelayMs = Math.max(
			...plan.boardEnterRequests.map((request) => request.enter?.delayMs ?? 0),
		);
		const lastOutputCleanupDelayMs = Math.max(
			...plan.boardEnterRequests.map((request) => request.cleanupDelayMs ?? 0),
		);
		const retainedStash = plan.boardTransientTilePlans[0];
		expect(retainedStash?.request).toMatchObject({
			exit: expect.objectContaining({
				delayMs: outputStartDelayMs,
				kind: "merge-out",
			}),
			tileId: "stash",
		});
		expect(retainedStash?.cleanupDelayMs).toBeLessThan(lastOutputCleanupDelayMs);
		expect(retainedStash?.tile).toMatchObject({
			id: "stash",
			itemId: "item:chest",
			slotId: "0:0",
		});
	});

	it("retains a depleted stash tile even when removal is emitted before spawn events", () => {
		const previousBoard = boardView([
			{
				id: "stash",
				itemId: "item:chest",
				state: {},
				x: 0,
				y: 0,
			},
		]);

		const plan = createGameEngineVisualPlan({
			currentBoard: boardView([
				{
					id: "output:1",
					itemId: "item:twig",
					state: {},
					x: 1,
					y: 0,
				},
				{
					id: "output:2",
					itemId: "item:stone",
					state: {},
					x: 2,
					y: 0,
				},
			]),
			currentInventory: undefined,
			events: [
				{
					itemId: "item:chest",
					itemInstanceId: "stash",
					reason: "producer-depleted",
					atMs: 1,
					type: "item.removed",
				},
				{
					itemId: "item:twig",
					originItemInstanceId: "stash",
					reason: "line-output",
					spawnSequenceIndex: 0,
					to: {
						itemInstanceId: "output:1",
						kind: "board",
						x: 1,
						y: 0,
					},
					type: "item.created",
				},
				{
					itemId: "item:stone",
					originItemInstanceId: "stash",
					reason: "line-output",
					spawnSequenceIndex: 1,
					to: {
						itemInstanceId: "output:2",
						kind: "board",
						x: 2,
						y: 0,
					},
					type: "item.created",
				},
			] satisfies GameEvent[],
			previousBoard,
		});

		const lastOutputStartDelayMs = Math.max(
			...plan.boardEnterRequests.map((request) => request.enter?.delayMs ?? 0),
		);
		expect(plan.boardTransientTilePlans[0]?.request.exit).toMatchObject({
			delayMs: lastOutputStartDelayMs,
			kind: "merge-out",
		});
	});

	it("animates removed board items that are not retained producer depletion placeholders", () => {
		const plan = createGameEngineVisualPlan({
			currentBoard: boardView([]),
			currentInventory: undefined,
			events: [
				{
					atMs: 1000,
					itemId: "item:tree",
					itemInstanceId: "resource",
					reason: "capacity-depleted",
					type: "item.removed",
				},
			] satisfies GameEvent[],
			previousBoard: boardView([
				{
					id: "resource",
					itemId: "item:tree",
					state: {},
					x: 2,
					y: 1,
				},
			]),
		});

		expect(plan.boardTransientTilePlans).toHaveLength(1);
		expect(plan.boardTransientTilePlans[0]?.request.exit).toMatchObject({
			delayMs: 0,
			durationMs: 260,
			kind: "remove",
		});
		expect(plan.boardTransientTilePlans[0]?.tile).toMatchObject({
			id: "resource",
			itemId: "item:tree",
			slotId: "2:1",
		});
	});

	it("does not create a board-origin transient remove for cheat inventory deletes", () => {
		const plan = createGameEngineVisualPlan({
			currentBoard: boardView([]),
			currentInventory: undefined,
			events: [
				{
					atMs: 1000,
					itemId: "item:twig",
					itemInstanceId: "deleted",
					reason: "debug-delete",
					type: "item.removed",
				},
			] satisfies GameEvent[],
			previousBoard: boardView([
				{
					id: "deleted",
					itemId: "item:twig",
					state: {},
					x: 2,
					y: 1,
				},
			]),
		});

		expect(plan.boardTransientTilePlans).toHaveLength(0);
	});

	it("does not let stash feedback hold a depleted stash tile on board", () => {
		const previousBoard = boardView([
			{
				id: "stash",
				itemId: "item:chest",
				state: {},
				x: 0,
				y: 0,
			},
		]);

		const plan = createGameEngineVisualPlan({
			currentBoard: boardView([
				{
					id: "output:1",
					itemId: "item:twig",
					state: {},
					x: 1,
					y: 0,
				},
			]),
			currentInventory: undefined,
			events: [
				{
					itemId: "item:key",
					nextQuantity: 1,
					previousQuantity: 0,
					quantity: 1,
					itemInstanceId: "stash",
					atMs: 1,
					type: "producer_input.stored",
					lineId: "line:stash",
				},
				{
					itemId: "item:twig",
					originItemInstanceId: "stash",
					reason: "line-output",
					to: {
						itemInstanceId: "output:1",
						kind: "board",
						x: 1,
						y: 0,
					},
					type: "item.created",
				},
				{
					itemId: "item:chest",
					itemInstanceId: "stash",
					reason: "producer-depleted",
					atMs: 1,
					type: "item.removed",
				},
			] satisfies GameEvent[],
			previousBoard,
		});

		expect(plan.boardFeedbackRequests).toHaveLength(1);
		expect(plan.boardFeedbackRequests[0]?.cleanupDelayMs).toBeGreaterThan(1000);

		const retainedStash = plan.boardTransientTilePlans[0];
		expect(retainedStash?.request.exit).toMatchObject({
			delayMs: 0,
			durationMs: 1,
			kind: "merge-out",
		});
		expect(retainedStash?.cleanupDelayMs).toBeLessThan(200);
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
					atMs: 1000,
					jobId: "job:1",
					itemInstanceId: "producer",
					lineId: "line:test",
					type: "line.completed",
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
					},
				},
			]),
			events: [
				{
					itemId: "item:twig",
					reason: "line-output",
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

	it("restores board memory items from memory without slow global creation sequencing", () => {
		const previousBoard = boardView([
			{
				id: "other-memory",
				itemId: "item:board-memory",
				state: {},
				x: 0,
				y: 0,
			},
			{
				id: "memory",
				itemId: "item:board-memory",
				state: {},
				x: 1,
				y: 0,
			},
			{
				id: "old:1",
				itemId: "item:rock",
				state: {},
				x: 2,
				y: 0,
			},
			{
				id: "old:2",
				itemId: "item:tree",
				state: {},
				x: 3,
				y: 0,
			},
		]);

		const plan = createGameEngineVisualPlan({
			currentBoard: boardView([
				{
					id: "other-memory",
					itemId: "item:board-memory",
					state: {},
					x: 0,
					y: 0,
				},
				{
					id: "memory",
					itemId: "item:board-memory",
					state: {},
					x: 1,
					y: 0,
				},
				{
					id: "new:1",
					itemId: "item:rock",
					state: {},
					x: 4,
					y: 0,
				},
				{
					id: "new:2",
					itemId: "item:tree",
					state: {},
					x: 5,
					y: 0,
				},
			]),
			currentInventory: emptyInventory(),
			events: [
				{
					from: {
						itemInstanceId: "old:1",
						kind: "board",
					},
					itemId: "item:rock",
					reason: "memory-store",
					type: "item.consumed",
				},
				{
					from: {
						itemInstanceId: "old:2",
						kind: "board",
					},
					itemId: "item:tree",
					reason: "memory-store",
					type: "item.consumed",
				},
				{
					itemId: "item:rock",
					originItemInstanceId: "memory",
					reason: "memory-restore",
					to: {
						itemInstanceId: "new:1",
						kind: "board",
						x: 3,
						y: 0,
					},
					type: "item.created",
				},
				{
					itemId: "item:tree",
					originItemInstanceId: "memory",
					reason: "memory-restore",
					to: {
						itemInstanceId: "new:2",
						kind: "board",
						x: 4,
						y: 0,
					},
					type: "item.created",
				},
				{
					atMs: 1000,
					boardItemId: "memory",
					restoredCount: 2,
					storedCount: 2,
					type: "board.memory.restored",
				},
			] satisfies GameEvent[],
			previousBoard,
		});

		expect(plan.boardTransientTilePlans).toHaveLength(2);
		expect(
			plan.boardTransientTilePlans.map((transient) => transient.request.exit?.toTileId),
		).toEqual([
			"memory",
			"memory",
		]);
		expect(plan.boardEnterRequests).toHaveLength(2);
		expect(plan.boardEnterRequests.map((request) => request.enter?.delayMs)).toEqual([
			260,
			294,
		]);
		expect(plan.boardEnterRequests[0]).toMatchObject({
			enter: {
				fromTileId: "memory",
				kind: "spawn-from-tile",
			},
			tileId: "new:1",
		});
		expect(plan.boardFeedbackRequests).toHaveLength(1);
		expect(plan.boardFeedbackRequests[0]).toMatchObject({
			feedback: {
				kind: "bounce",
				pulseCount: 2,
			},
			tileId: "memory",
		});
	});

	it("spawns memory restore visuals from the activated memory start position when memory also moves", () => {
		const plan = createGameEngineVisualPlan({
			currentBoard: boardView([
				{
					id: "memory",
					itemId: "item:board-memory",
					state: {},
					x: 1,
					y: 0,
				},
				{
					id: "restored:rock",
					itemId: "item:rock",
					state: {},
					x: 2,
					y: 0,
				},
			]),
			currentInventory: emptyInventory(),
			events: [
				{
					from: {
						itemInstanceId: "memory",
						kind: "board",
					},
					itemId: "item:board-memory",
					reason: "memory-store",
					type: "item.consumed",
				},
				{
					itemId: "item:rock",
					originItemInstanceId: "memory",
					reason: "memory-restore",
					to: {
						itemInstanceId: "restored:rock",
						kind: "board",
						x: 2,
						y: 0,
					},
					type: "item.created",
				},
				{
					atMs: 1000,
					boardItemId: "memory",
					restoredCount: 1,
					storedCount: 1,
					type: "board.memory.restored",
				},
			] satisfies GameEvent[],
			previousBoard: boardView([
				{
					id: "memory",
					itemId: "item:board-memory",
					state: {},
					x: 5,
					y: 0,
				},
			]),
		});

		expect(plan.boardTransientTilePlans).toHaveLength(1);
		expect(plan.boardEnterRequests[0]).toMatchObject({
			enter: {
				fromTileId: "transient:memory-store:engine:memory-store:memory:0:source:memory",
				kind: "spawn-from-tile",
			},
			tileId: "restored:rock",
		});
	});

	it("adds board memory save feedback even when no board item moves", () => {
		const plan = createGameEngineVisualPlan({
			currentBoard: boardView([
				{
					id: "memory",
					itemId: "item:board-memory",
					state: {},
					x: 1,
					y: 0,
				},
			]),
			currentInventory: emptyInventory(),
			events: [
				{
					atMs: 1000,
					boardItemId: "memory",
					itemCount: 0,
					type: "board.memory.saved",
				},
			] satisfies GameEvent[],
			previousBoard: boardView([
				{
					id: "memory",
					itemId: "item:board-memory",
					state: {},
					x: 1,
					y: 0,
				},
			]),
		});

		expect(plan.boardFeedbackRequests).toHaveLength(1);
		expect(plan.boardFeedbackRequests[0]).toMatchObject({
			feedback: {
				kind: "bounce",
			},
			tileId: "memory",
		});
	});
});
