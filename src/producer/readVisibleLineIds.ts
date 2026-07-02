import type { GameConfig } from "~/config/GameConfigSchema";
import {
	readLineDefinition,
	type GameProducerCapabilityDefinition,
} from "~/config/GameItemCapabilities";
import { readEffectiveLine } from "~/effects/readEffectiveLine";
import type { GameSave } from "~/engine/model/GameSaveSchema";

export namespace readVisibleLineIds {
	export interface Props {
		config: GameConfig;
		nowMs?: number;
		itemInstanceId: string;
		lineIds: readonly string[];
		producerDefinition: GameProducerCapabilityDefinition;
		save: GameSave;
	}
}

export const readVisibleLineIds = ({
	config,
	nowMs,
	producerDefinition,
	itemInstanceId,
	lineIds,
	save,
}: readVisibleLineIds.Props) =>
	lineIds.filter((lineId) => {
		const line = readLineDefinition({
			producerDefinition,
			lineId,
		});
		return Boolean(
			line &&
				readEffectiveLine({
					baseDurationMs: line.durationMs,
					config,
					nowMs,
					itemInstanceId,
					line,
					lineId,
					save,
				}).visible,
		);
	});
