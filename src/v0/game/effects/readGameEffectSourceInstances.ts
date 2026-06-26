import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import type { GameEffectSourceInstance } from "~/v0/game/effects/GameEffectSourceInstance";

export namespace readGameEffectSourceInstances {
	export interface Props {
		config: GameConfig;
		nowMs?: number;
		save: GameSave;
	}
}

export const readGameEffectSourceInstances = ({
	config,
	nowMs,
	save,
}: readGameEffectSourceInstances.Props): GameEffectSourceInstance[] => {
	const passiveSources = Object.values(save.board.items).flatMap((item) => {
		const itemDefinition = config.items[item.itemId];
		return (itemDefinition?.passiveEffectIds ?? []).map((effectId) => ({
			activatedAtMs: 0,
			effectId,
			kind: "passive" as const,
			sourceId: item.id,
			sourceItemInstanceId: item.id,
		}));
	});

	const activeSources = Object.values(save.activeEffects ?? {})
		.filter((effect) => nowMs === undefined || effect.expiresAtMs > nowMs)
		.map((effect) => ({
			activatedAtMs: effect.activatedAtMs,
			effectId: effect.effectId,
			kind: "active" as const,
			sourceId: effect.id,
			sourceItemInstanceId: effect.sourceItemInstanceId,
		}));

	return [
		...passiveSources,
		...activeSources,
	].filter((source) => Boolean(config.effects[source.effectId]));
};
