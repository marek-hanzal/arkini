import type { GameActivationInputMode } from "~/v0/game/requirements/GameActivationInputMode";

export interface GameActivationInputRequirement {
	quantity: number;
	consume: boolean;
	mode?: GameActivationInputMode;
}
