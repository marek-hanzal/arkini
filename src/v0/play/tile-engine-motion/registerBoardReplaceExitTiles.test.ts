import { afterEach, describe, expect, it, vi } from "vitest";
import {
	clearBoardTransientTiles,
	readBoardTransientTiles,
} from "~/v0/board/animation/BoardTransientTileStore";
import { rebuildBoardView } from "~/v0/board/view/rebuildBoardView";
import { ActionVisualAnimation } from "~/v0/play/action/ActionVisualAnimation";
import type { ActionVisualEventSchema } from "~/v0/play/action/ActionVisualEventSchema";
import { actionVisualMotionSettlementDelayMs } from "~/v0/play/tile-engine-motion/actionVisualMotionSettlementDelayMs";
import { registerBoardReplaceExitTiles } from "~/v0/play/tile-engine-motion/registerBoardReplaceExitTiles";
import { clearTileEngineMotionRequests, readTileEngineMotionRequests } from "~/v0/tile-engine";

const boardView = () =>
	rebuildBoardView([
		{
			id: "target",
			itemId: "item:blueprint",
			x: 1,
			y: 0,
			state: {},
		},
	]);

afterEach(() => {
	clearBoardTransientTiles();
	clearTileEngineMotionRequests();
	vi.useRealTimers();
});

describe("registerBoardReplaceExitTiles", () => {
	it("keeps the previous replaced item as a fading board transient", () => {
		vi.useFakeTimers();
		clearBoardTransientTiles();
		clearTileEngineMotionRequests();

		const animation = ActionVisualAnimation.replace({
			cause: "craft",
			groupId: "engine:craft-result:target",
		});
		const event = {
			type: "item.replaced",
			animation,
			fromItemId: "item:blueprint",
			itemInstanceId: "target",
			reason: "craft-result",
			toItemId: "item:lumber-camp-1",
		} satisfies ActionVisualEventSchema.Type;

		registerBoardReplaceExitTiles({
			board: boardView(),
			events: [
				event,
			],
		});

		const transientTiles = readBoardTransientTiles();
		expect(transientTiles).toMatchObject([
			{
				groupId: "engine:craft-result:target",
				itemId: "item:blueprint",
				slotId: "1:0",
			},
		]);
		const transientTile = transientTiles[0];
		expect(transientTile).toBeDefined();
		expect(
			readTileEngineMotionRequests("board").get(transientTile?.id ?? "")?.exit,
		).toMatchObject({
			groupId: "engine:craft-result:target",
			kind: "replace-out",
		});

		vi.advanceTimersByTime(actionVisualMotionSettlementDelayMs(animation) - 1);
		expect(readBoardTransientTiles()).toHaveLength(1);

		vi.advanceTimersByTime(1);
		expect(readBoardTransientTiles()).toHaveLength(0);
		expect(readTileEngineMotionRequests("board").size).toBe(0);
	});

	it("ignores non-replace replacement state events", () => {
		clearBoardTransientTiles();
		clearTileEngineMotionRequests();

		const event = {
			type: "item.replaced",
			animation: ActionVisualAnimation.state({
				cause: "stash",
				groupId: "engine:stash-depleted:target",
			}),
			fromItemId: "item:twig",
			itemInstanceId: "target",
			reason: "stash-depleted",
			toItemId: "item:plank",
		} satisfies ActionVisualEventSchema.Type;

		registerBoardReplaceExitTiles({
			board: boardView(),
			events: [
				event,
			],
		});

		expect(readBoardTransientTiles()).toHaveLength(0);
		expect(readTileEngineMotionRequests("board").size).toBe(0);
	});
});
