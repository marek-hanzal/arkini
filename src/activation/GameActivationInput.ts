import type { GameActivationInputMode } from "~/activation/GameActivationInputMode";

export interface GameActivationInput {
	capacity?: number;
	itemId: string;
	quantity: number;
	consume: boolean;
	mode?: GameActivationInputMode;
}
