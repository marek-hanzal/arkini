import { useGameCommand } from "~/bridge/game/useGameCommand";
import { autofillLineInputsFx } from "~/engine/input/write/autofillLineInputsFx";

/** Autofills one exact Item Detail line through the canonical input command. */
export const useAutofillItemDetailLine = () => useGameCommand(autofillLineInputsFx);
