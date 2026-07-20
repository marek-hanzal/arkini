import { useGameCommand } from "~/bridge/game/useGameCommand";
import { withdrawLineInputsFx } from "~/engine/input/write/withdrawLineInputsFx";

/** Withdraws one exact Item Detail line through canonical placement. */
export const useWithdrawItemDetailLine = () => useGameCommand(withdrawLineInputsFx);
