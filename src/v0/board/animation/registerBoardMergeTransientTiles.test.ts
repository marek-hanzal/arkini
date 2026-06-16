import { describe, expect, it, vi } from "vitest";
import { rebuildBoardView } from "~/v0/board/view/rebuildBoardView";
import { ActionVisualAnimation } from "~/v0/play/action/ActionVisualAnimation";
import type { ActionVisualEventSchema } from "~/v0/play/action/ActionVisualEventSchema";
import { actionVisualMotionSettlementDelayMs } from "~/v0/play/tile-engine-motion/actionVisualMotionSettlementDelayMs";
import {
	clearBoardTransientTiles,
	readBoardTransientTiles,
} from "~/v0/board/animation/BoardTransientTileStore";
import { registerBoardMergeTransientTiles } from "~/v0/board/animation/registerBoardMergeTransientTiles";

const boardView = () =>
	rebuildBoardView([
		{
			id: "source",
			itemId: "item:twig",
			x: 0,
			y: 0,
			state: {},
		},
		{
			id: "target",
			itemId: "item:twig",
			x: 1,
			y: 0,
			state: {},
		},
	]);

describe("registerBoardMergeTransientTiles", () => {
	it("keeps delayed exit transients until the motion settles", () => {
		vi.useFakeTimers();
		clearBoardTransientTiles();

		const animation = {
			...ActionVisualAnimation.merge({
				cause: "merge",
				groupId: "merge:source:target",
			}),
			delayMs: 200,
			durationMs: 390,
		};
		const event = {
			type: "item.merged",
			animation,
			sourceItemInstanceId: "source",
			sourceItemId: "item:twig",
			targetItemInstanceId: "target",
			targetItemId: "item:twig",
			resultItemId: "item:branch",
			consumeSource: true,
		} satisfies ActionVisualEventSchema.Type;

		registerBoardMergeTransientTiles({
			board: boardView(),
			events: [
				event,
			],
		});

		expect(readBoardTransientTiles()).toHaveLength(2);

		vi.advanceTimersByTime(actionVisualMotionSettlementDelayMs(animation) - 1);
		expect(readBoardTransientTiles()).toHaveLength(2);

		vi.advanceTimersByTime(1);
		expect(readBoardTransientTiles()).toHaveLength(0);

		vi.useRealTimers();
	});
});
