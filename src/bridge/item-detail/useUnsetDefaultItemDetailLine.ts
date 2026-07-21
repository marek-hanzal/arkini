import { useGameCommand } from "~/bridge/game/useGameCommand";
import { unsetDefaultLineFx } from "~/engine/line/write/unsetDefaultLineFx";

/** Removes the authoritative save-backed default line from an exact Item Detail owner. */
export const useUnsetDefaultItemDetailLine = () => useGameCommand(unsetDefaultLineFx);
