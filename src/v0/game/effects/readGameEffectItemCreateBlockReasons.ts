import type { BoardCell } from "~/v0/game/board/BoardCell";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import type { BlockedGameEffectOperation } from "~/v0/game/effects/BlockedGameEffectOperation";
import { compareGameEffectSourceInstances } from "~/v0/game/effects/compareGameEffectSourceInstances";
import { doesGameEffectTargetItem } from "~/v0/game/effects/doesGameEffectTargetItem";
import { doesGameEffectSourceApplyToBoardCell } from "~/v0/game/effects/doesGameEffectSourceApplyToBoardCell";
import { readGameEffectSourceInstances } from "~/v0/game/effects/readGameEffectSourceInstances";

export namespace readGameEffectItemCreateBlockReasons {
	export interface Props {
		config: GameConfig;
		ignoredSourceIds?: ReadonlySet<string>;
		itemId: string;
		nowMs?: number;
		save: GameSave;
		targetCell?: BoardCell;
	}
}

export const readGameEffectItemCreateBlockReasons = ({
	config,
	ignoredSourceIds,
	itemId,
	nowMs,
	save,
	targetCell,
}: readGameEffectItemCreateBlockReasons.Props): BlockedGameEffectOperation[] => {
	const reasons: BlockedGameEffectOperation[] = [];

	const sources = readGameEffectSourceInstances({
		config,
		nowMs,
		save,
	})
		.filter((source) => !ignoredSourceIds?.has(source.sourceId))
		.sort((left, right) =>
			compareGameEffectSourceInstances({
				config,
				left,
				right,
				save,
				targetCell,
			}),
		);

	for (const source of sources) {
		const effect = config.effects[source.effectId];
		if (!effect) continue;
		if (
			!doesGameEffectSourceApplyToBoardCell({
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
