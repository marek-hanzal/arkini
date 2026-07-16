import type { GameActivationInputMode } from "~/activation/GameActivationInputMode";

export const readActivationInputMode = (input: { mode?: GameActivationInputMode }) =>
	input.mode ?? "exact";
