import type { GameEventOfType } from "~/event/GameEventOfType";

export type BoardMemoryEvent = GameEventOfType<
	"board.memory.saved" | "board.memory.restored" | "board.memory.cleared"
>;
