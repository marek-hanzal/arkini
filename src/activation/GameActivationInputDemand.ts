import type { GameActivationInputMode } from "~/activation/GameActivationInputMode";

export interface GameActivationInputDemand {
	quantity: number;
	consume: boolean;
	mode?: GameActivationInputMode;
}
