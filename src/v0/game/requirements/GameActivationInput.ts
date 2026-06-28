import type { GameActivationInputMode } from "~/v0/game/requirements/GameActivationInputMode";

export interface GameActivationInput {
	capacity?: number;
	itemId: string;
	quantity: number;
	consume: boolean;
	mode?: GameActivationInputMode;
}
