import { afterEach, describe, expect, it, vi } from "vitest";
import {
	clearBoardTransientTiles,
	readBoardTransientTiles,
} from "~/v0/board/animation/BoardTransientTileStore";
import { applyGameEngineVisualPlan } from "~/v0/play/game-engine-visual/applyGameEngineVisualPlan";
import type { GameEngineVisualPlan } from "~/v0/play/game-engine-visual/GameEngineVisualPlan";
import { clearTileEngineMotionRequests, readTileEngineMotionRequests } from "~/v0/tile-engine";

afterEach(() => {
	vi.useRealTimers();
	clearBoardTransientTiles();
	clearTileEngineMotionRequests();
});

describe("applyGameEngineVisualPlan", () => {
	it("registers transient exit and board enter requests from one visual plan", () => {
		vi.useFakeTimers();
		const plan: GameEngineVisualPlan = {
			boardFeedbackRequests: [
				{
					cleanupDelayMs: 100,
					feedback: {
						groupId: "group:1",
						kind: "bounce",
					},
					tileId: "target",
				},
			],
			boardEnterRequests: [
				{
					cleanupDelayMs: 100,
					enter: {
						groupId: "group:1",
						kind: "replace-in",
					},
					tileId: "target",
				},
			],
			boardTransientTilePlans: [
				{
					cleanupDelayMs: 100,
					groupId: "group:1",
					request: {
						cleanupDelayMs: 100,
						exit: {
							groupId: "group:1",
							kind: "replace-out",
						},
						tileId: "transient:1",
					},
					tile: {
						groupId: "group:1",
						id: "transient:1",
						itemId: "item:twig",
						slotId: "1:0",
					},
				},
			],
			ignoredEventTypes: [],
			inventoryEnterRequests: [],
		};

		applyGameEngineVisualPlan({
			plan,
		});

		expect(readBoardTransientTiles()).toMatchObject([
			{
				id: "transient:1",
				itemId: "item:twig",
			},
		]);
		expect(readTileEngineMotionRequests("board").get("transient:1")?.exit).toMatchObject({
			kind: "replace-out",
		});
		expect(readTileEngineMotionRequests("board").get("target")?.enter).toMatchObject({
			kind: "replace-in",
		});
		expect(readTileEngineMotionRequests("board").get("target")?.feedback).toMatchObject({
			kind: "bounce",
		});

		vi.advanceTimersByTime(100);
		expect(readBoardTransientTiles()).toEqual([]);
	});
});
