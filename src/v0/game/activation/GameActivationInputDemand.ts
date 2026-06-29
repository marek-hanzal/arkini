import type { GameActivationInputMode } from "~/v0/game/activation/GameActivationInputMode";

export interface GameActivationInputDemand {
	quantity: number;
	consume: boolean;
	mode?: GameActivationInputMode;
}
