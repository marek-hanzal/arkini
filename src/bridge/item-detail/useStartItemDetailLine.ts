import { useGameCommand } from "~/bridge/game/useGameCommand";
import { startLineFx } from "~/engine/job/write/startLineFx";

/** Starts or enqueues one authoritative Item Detail line request. */
export const useStartItemDetailLine = () => useGameCommand(startLineFx);
