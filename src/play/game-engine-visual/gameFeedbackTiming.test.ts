import { describe, expect, it } from "vitest";
import { boardMemoryRestoredFeedbackDurationMs } from "~/play/game-engine-visual/boardMemoryFeedbackDurations";
import { boardStackFeedbackDurationMs } from "~/play/game-engine-visual/boardStackFeedbackDurationMs";
import { capacityTapFeedbackDurationMs } from "~/play/game-engine-visual/capacityTapFeedbackDurationMs";
import { feedbackFlagDurationMs } from "~/play/feedback/useFeedbackFlags";
import { TileEngineTiming } from "~/tile-engine/TileEngineTiming";

describe("game feedback timing", () => {
	it("keeps non-interactive feedbacks visibly longer than fast pointer motions", () => {
		const snapDurationMs = TileEngineTiming.snapDurationSeconds * 1000;
		const rejectDurationMs = TileEngineTiming.rejectDurationSeconds * 1000;

		expect(feedbackFlagDurationMs).toBeGreaterThan(rejectDurationMs);
		expect(capacityTapFeedbackDurationMs).toBeGreaterThan(snapDurationMs);
		expect(boardMemoryRestoredFeedbackDurationMs * 2).toBeGreaterThan(
			TileEngineTiming.moveDurationSeconds * 1000,
		);
		expect(boardStackFeedbackDurationMs).toBeGreaterThan(
			TileEngineTiming.moveDurationSeconds * 1000,
		);
	});

	it("does not slow the direct drag interaction lifecycle", () => {
		expect(TileEngineTiming.snapDurationSeconds).toBe(0.24);
		expect(TileEngineTiming.rejectDurationSeconds).toBe(0.27);
		expect(TileEngineTiming.moveDurationSeconds).toBe(0.42);
	});
});
