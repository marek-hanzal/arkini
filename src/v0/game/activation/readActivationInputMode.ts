import type { GameActivationInputMode } from "~/v0/game/activation/GameActivationInputMode";

export const readActivationInputMode = (input: { mode?: GameActivationInputMode }) =>
	input.mode ?? "exact";
