import type { GameConfigService } from "~/manifest/context/GameConfigServiceFx";
import type { ItemId } from "~/manifest/data/manifestId";
import type { ProducerDefinition } from "~/manifest/data/producer";
import type { OwnedUpgradeRow } from "~/upgrade/logic/readOwnedUpgradeEffects";
import { readOwnedUpgradeEffects } from "~/upgrade/logic/readOwnedUpgradeEffects";

export namespace applyProducerUpgradeEffects {
	export interface Props {
		gameConfig: GameConfigService;
		producerItemId: string | ItemId;
		producer: ProducerDefinition;
		upgradeRows: readonly OwnedUpgradeRow[];
	}
}

export function applyProducerUpgradeEffects({
	gameConfig,
	producerItemId,
	producer,
	upgradeRows,
}: applyProducerUpgradeEffects.Props): ProducerDefinition {
	let cooldownMs = producer.cooldownMs ?? 0;
	let output = producer.output;
	let outputTableId = producer.outputTableId;

	for (const effect of readOwnedUpgradeEffects(gameConfig, upgradeRows)) {
		if (effect.itemId !== producerItemId) continue;

		if (effect.type === "producer.cooldown.add") {
			cooldownMs = Math.max(250, cooldownMs + effect.ms);
		}

		if (effect.type === "producer.outputTable.set") {
			outputTableId = effect.tableId;
			output = gameConfig.getLootTable(effect.tableId)?.output ?? output;
		}
	}

	if (outputTableId && output === producer.output) {
		output = gameConfig.getLootTable(outputTableId)?.output ?? output;
	}

	return {
		...producer,
		cooldownMs,
		output,
		outputTableId,
	};
}
