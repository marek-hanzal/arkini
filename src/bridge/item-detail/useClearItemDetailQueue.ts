import { useGameCommand } from "~/bridge/game/useGameCommand";
import { clearItemJobQueueFx } from "~/engine/job/write/clearItemJobQueueFx";

/** Clears only queued line-start intents for one exact Item Detail target. */
export const useClearItemDetailQueue = () => useGameCommand(clearItemJobQueueFx);
