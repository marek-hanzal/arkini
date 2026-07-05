import { describe, expect, it } from "vitest";
import { rebuildBoardView } from "~/board/view/rebuildBoardView";
import type { GameEvent } from "~/event/GameEventSchema";
import { capacityTapFeedbackDurationMs } from "~/play/game-engine-visual/capacityTapFeedbackDurationMs";
import { createGameEngineVisualPlan } from "~/play/game-engine-visual/createGameEngineVisualPlan";
import { tileRemoveDurationMs } from "~/tile-engine/TileRemoveMotion";

const boardView = (items: Parameters<typeof rebuildBoardView>[0]) => rebuildBoardView(items);

const stoneDeposit = ({ remaining }: { remaining: number }) => ({
	capacity: {
		max: 6,
		remaining,
	},
	id: "deposit",
	itemId: "item:stone-deposit",
	state: {},
	x: 2,
	y: 1,
});

describe("capacity tap visuals", () => {
	it("maps capacity spend to source deposit bounce feedback", () => {
		const plan = createGameEngineVisualPlan({
			currentBoard: boardView([
				stoneDeposit({
					remaining: 5,
				}),
			]),
			currentInventory: undefined,
			events: [
				{
					amount: 1,
					atMs: 100,
					itemId: "item:stone-deposit",
					itemInstanceId: "deposit",
					max: 6,
					nextRemaining: 5,
					previousRemaining: 6,
					type: "item.capacity.changed",
				},
			] satisfies GameEvent[],
			previousBoard: boardView([
				stoneDeposit({
					remaining: 6,
				}),
			]),
		});

		expect(plan.boardFeedbackRequests).toHaveLength(1);
		expect(plan.boardFeedbackRequests[0]).toMatchObject({
			feedback: {
				durationMs: capacityTapFeedbackDurationMs,
				groupId: "engine:capacity-tap:deposit:100",
				kind: "bounce",
			},
			tileId: "deposit",
		});
		expect(plan.ignoredEventTypes).toContain("item.capacity.changed");
	});

	it("retains depleted capacity sources until the tap feedback finishes", () => {
		const plan = createGameEngineVisualPlan({
			currentBoard: boardView([]),
			currentInventory: undefined,
			events: [
				{
					amount: 1,
					atMs: 100,
					itemId: "item:stone-deposit",
					itemInstanceId: "deposit",
					max: 6,
					nextRemaining: 0,
					previousRemaining: 1,
					type: "item.capacity.changed",
				},
				{
					atMs: 100,
					itemId: "item:stone-deposit",
					itemInstanceId: "deposit",
					type: "item.capacity.depleted",
				},
				{
					atMs: 100,
					itemId: "item:stone-deposit",
					itemInstanceId: "deposit",
					reason: "capacity-depleted",
					type: "item.removed",
				},
			] satisfies GameEvent[],
			previousBoard: boardView([
				stoneDeposit({
					remaining: 1,
				}),
			]),
		});

		expect(plan.boardFeedbackRequests).toHaveLength(1);
		expect(plan.boardTransientTilePlans).toHaveLength(1);
		expect(plan.boardTransientTilePlans[0]?.request.exit).toMatchObject({
			delayMs: capacityTapFeedbackDurationMs,
			durationMs: tileRemoveDurationMs,
			kind: "remove",
		});
		expect(plan.ignoredEventTypes).toEqual(
			expect.arrayContaining([
				"item.capacity.changed",
				"item.capacity.depleted",
				"item.removed",
			]),
		);
	});
});
