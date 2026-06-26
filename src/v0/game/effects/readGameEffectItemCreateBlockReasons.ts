import type { BoardCell } from "~/v0/game/board/BoardCell";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import type { BlockedGameEffectOperation } from "~/v0/game/effects/BlockedGameEffectOperation";
import { doesGameEffectTargetItem } from "~/v0/game/effects/doesGameEffectTargetItem";
import { readChebyshevDistance } from "~/v0/game/effects/readChebyshevDistance";
import { readGameEffectSourceCell } from "~/v0/game/effects/readGameEffectSourceCell";
import { readGameEffectSourceInstances } from "~/v0/game/effects/readGameEffectSourceInstances";
import type { GameEffectSourceInstance } from "~/v0/game/effects/GameEffectSourceInstance";

export namespace readGameEffectItemCreateBlockReasons {
	export interface Props {
		config: GameConfig;
		itemId: string;
		nowMs?: number;
		save: GameSave;
		targetCell?: BoardCell;
	}
}

const readSourceAppliesToTargetCell = ({
	config,
	save,
	source,
	targetCell,
}: {
	config: GameConfig;
	save: GameSave;
	source: GameEffectSourceInstance;
	targetCell?: BoardCell;
}) => {
	const effect = config.effects[source.effectId];
	if (!effect) return false;
	if (effect.scope === "global") return true;
	if (!targetCell) return false;

	const sourceCell = readGameEffectSourceCell({
		save,
		sourceItemInstanceId: source.sourceItemInstanceId,
	});
	if (!sourceCell) return false;

	return readChebyshevDistance(sourceCell, targetCell) <= effect.radius;
};

export const readGameEffectItemCreateBlockReasons = ({
	config,
	itemId,
	nowMs,
	save,
	targetCell,
}: readGameEffectItemCreateBlockReasons.Props): BlockedGameEffectOperation[] => {
	const reasons: BlockedGameEffectOperation[] = [];

	for (const source of readGameEffectSourceInstances({
		config,
		nowMs,
		save,
	})) {
		const effect = config.effects[source.effectId];
		if (!effect) continue;
		if (
			!readSourceAppliesToTargetCell({
				config,
				save,
				source,
				targetCell,
			})
		) {
			continue;
		}

		for (const operation of effect.operations) {
			if (operation.kind !== "item.blockCreate") continue;
			if (
				!doesGameEffectTargetItem({
					config,
					itemId,
					target: operation.target,
				})
			) {
				continue;
			}

			reasons.push({
				effectId: source.effectId,
				effectName: effect.name,
				kind: "item.blockCreate",
				reason: operation.reason,
				sourceId: source.sourceId,
				sourceItemInstanceId: source.sourceItemInstanceId,
				targetItemId: itemId,
			});
		}
	}

	return reasons;
};
