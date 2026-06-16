import { describe, expect, it } from "vitest";
import { ActionVisualAnimation } from "~/v0/play/action/ActionVisualAnimation";
import { actionVisualMotionSettlementDelayMs } from "~/v0/play/tile-engine-motion/actionVisualMotionSettlementDelayMs";
import { TileEngineTiming } from "~/v0/tile-engine";

describe("actionVisualMotionSettlementDelayMs", () => {
	it("waits for sequence delay, duration and cleanup buffer", () => {
		const animation = ActionVisualAnimation.sequenceFadeIn({
			cause: "producer",
			groupId: "spawn:producer",
			sequenceIndex: 3,
		});

		expect(actionVisualMotionSettlementDelayMs(animation)).toBe(
			(animation.delayMs ?? 0) +
				(animation.durationMs ?? 0) +
				TileEngineTiming.motionCleanupBufferMs,
		);
	});
});
