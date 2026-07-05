import { boardStackFeedbackDurationMs } from "~/play/game-engine-visual/boardStackFeedbackDurationMs";
import type { GameVisualMotion } from "~/play/game-engine-visual/GameVisualMotion";

const firstBouncePeakOffsetRatio = 1 / 5;

export const readBoardStackFeedbackDelayMs = (
	motion: Pick<GameVisualMotion, "delayMs" | "durationMs">,
) =>
	Math.max(
		0,
		(motion.delayMs ?? 0) +
			(motion.durationMs ?? 0) -
			boardStackFeedbackDurationMs * firstBouncePeakOffsetRatio,
	);
