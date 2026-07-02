import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import {
	readProducerLineDefinition,
	type GameProducerCapabilityDefinition,
} from "~/v0/game/config/GameItemCapabilities";
import { readEffectiveProducerLine } from "~/v0/game/effects/readEffectiveProducerLine";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace readVisibleProducerLineIds {
	export interface Props {
		config: GameConfig;
		nowMs?: number;
		producerItemInstanceId: string;
		lineIds: readonly string[];
		producerDefinition: GameProducerCapabilityDefinition;
		save: GameSave;
	}
}

export const readVisibleProducerLineIds = ({
	config,
	nowMs,
	producerDefinition,
	producerItemInstanceId,
	lineIds,
	save,
}: readVisibleProducerLineIds.Props) =>
	lineIds.filter((lineId) => {
		const line = readProducerLineDefinition({
			producerDefinition,
			lineId,
		});
		return Boolean(
			line &&
				readEffectiveProducerLine({
					baseDurationMs: line.durationMs,
					config,
					nowMs,
					producerItemInstanceId,
					line,
					lineId,
					save,
				}).visible,
		);
	});
