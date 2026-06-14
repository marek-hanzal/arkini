import type { GameConfigService } from "~/manifest/context/GameConfigServiceFx";
import type { ItemId } from "~/manifest/manifestId";
import type { ProducerDefinition } from "~/manifest/producer";
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
	let cooldownMs = producer.cooldownMs;
	let outputTableId = producer.outputTableId;

	for (const effect of readOwnedUpgradeEffects(gameConfig, upgradeRows)) {
		if (effect.itemId !== producerItemId) continue;

		if (effect.type === "producer.cooldown.add") {
			cooldownMs = Math.max(250, cooldownMs + effect.ms);
		}

		if (effect.type === "producer.outputTable.set") {
			outputTableId = effect.tableId;
		}
	}

	return {
		...producer,
		cooldownMs,
		outputTableId,
	};
}
