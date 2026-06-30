import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export const gameCheatInstantDurationMs = 1000;

export type GameCheatSpeedMode = "normal" | "instant";

export const readGameCheatSpeedMode = ({ save }: { save: GameSave }): GameCheatSpeedMode =>
	save.cheats?.speedMode ?? "normal";

export const readGameCheatEffectiveDurationMs = ({
	durationMs,
	save,
}: {
	durationMs: number;
	save: GameSave;
}) => {
	const normalizedDurationMs = Math.max(0, durationMs);
	if (
		readGameCheatSpeedMode({
			save,
		}) !== "instant"
	)
		return normalizedDurationMs;
	if (normalizedDurationMs === 0) return 0;
	return gameCheatInstantDurationMs;
};
