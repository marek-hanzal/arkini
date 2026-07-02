import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { readGameEffectSourceInstances } from "~/v0/game/effects/readGameEffectSourceInstances";

export namespace readGameWorldGrantIds {
	export interface Props {
		config: GameConfig;
		ignoredProducerJobIds?: ReadonlySet<string>;
		ignoredSourceIds?: ReadonlySet<string>;
		nowMs?: number;
		save: GameSave;
	}
}

export const readGameWorldGrantIds = ({
	config,
	ignoredProducerJobIds,
	ignoredSourceIds,
	nowMs,
	save,
}: readGameWorldGrantIds.Props) => {
	const grants = new Set<string>();

	for (const source of readGameEffectSourceInstances({
		config,
		ignoredProducerJobIds,
		nowMs,
		save,
	})) {
		if (ignoredSourceIds?.has(source.sourceId)) continue;
		for (const grant of source.effect.grants) grants.add(grant.id);
	}

	return grants;
};
