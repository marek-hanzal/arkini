import { useGameCommand } from "~/bridge/game/useGameCommand";
import { setDefaultLineFx } from "~/engine/line/write/setDefaultLineFx";

/** Selects one authoritative save-backed default line for an exact Item Detail owner. */
export const useSetDefaultItemDetailLine = () => useGameCommand(setDefaultLineFx);
