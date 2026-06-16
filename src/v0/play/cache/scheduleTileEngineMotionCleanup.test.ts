import { describe, expect, it } from "vitest";
import { ActionVisualAnimation } from "~/v0/play/action/ActionVisualAnimation";
import { tileEngineMotionCleanupDelayMs } from "~/v0/play/cache/scheduleTileEngineMotionCleanup";
import { TileEngineTiming } from "~/v0/tile-engine/TileEngineTiming";

describe("tileEngineMotionCleanupDelayMs", () => {
	it("waits for sequence delay, duration and cleanup buffer", () => {
		const animation = ActionVisualAnimation.sequenceFadeIn({
			cause: "producer",
			groupId: "spawn:producer",
			sequenceIndex: 3,
		});

		expect(tileEngineMotionCleanupDelayMs(animation)).toBe(
			(animation.delayMs ?? 0) +
				(animation.durationMs ?? 0) +
				TileEngineTiming.motionCleanupBufferMs,
		);
	});
});
