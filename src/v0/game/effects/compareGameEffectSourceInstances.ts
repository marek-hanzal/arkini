import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameEffectSourceInstance } from "~/v0/game/effects/GameEffectSourceInstance";

export const compareGameEffectSourceInstances = ({
	config,
	left,
	right,
}: {
	config: GameConfig;
	left: GameEffectSourceInstance;
	right: GameEffectSourceInstance;
}) => {
	const leftEffect = config.effects[left.effectId];
	const rightEffect = config.effects[right.effectId];
	const leftScopePriority = leftEffect?.scope === "local" ? 0 : 1;
	const rightScopePriority = rightEffect?.scope === "local" ? 0 : 1;
	if (leftScopePriority !== rightScopePriority) return leftScopePriority - rightScopePriority;
	if (left.startAtMs !== right.startAtMs) return left.startAtMs - right.startAtMs;
	return (
		left.sourceId.localeCompare(right.sourceId) || left.effectId.localeCompare(right.effectId)
	);
};
