import type { GameActivationInputMode } from "~/v0/game/requirements/GameActivationInputMode";

export const readActivationInputMode = (input: { mode?: GameActivationInputMode }) =>
	input.mode ?? "exact";
