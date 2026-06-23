import type { GameActivationInput } from "~/v0/game/requirements/GameActivationInput";

export const readStashInputCapacity = (input: GameActivationInput) =>
	input.capacity ?? input.quantity;
