import type { GameEventOfType } from "~/event/GameEventOfType";

export type ActivationInputStoredEvent = GameEventOfType<
	"producer_input.stored" | "craft_input.stored"
>;
