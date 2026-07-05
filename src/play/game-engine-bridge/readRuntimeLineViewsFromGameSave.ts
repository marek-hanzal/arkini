import type { LineView } from "~/board/view/LineViewSchema";
import type { GameConfig } from "~/config/GameConfigTypes";
import {
	readLineDefinition,
	type GameProducerCapabilityDefinition,
} from "~/config/GameItemCapabilities";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { readVisibleLineIds } from "~/producer/readVisibleLineIds";
import { readLineIdsVisibleOrCurrentlyQueued } from "~/play/game-engine-bridge/readLineIdsVisibleOrCurrentlyQueued";
import { readRuntimeLineDefaultSelection } from "~/play/game-engine-bridge/readRuntimeLineDefaultSelection";
import { readRuntimeLineViewFromDefinition } from "~/play/game-engine-bridge/readRuntimeLineViewFromDefinition";
import { readRuntimeProducerQueueViewState } from "~/play/game-engine-bridge/readRuntimeProducerQueueViewState";

export namespace readRuntimeLineViewsFromGameSave {
	export interface Props {
		config: GameConfig;
		maxQueueSize: number;
		nowMs: number;
		producerDefinition: GameProducerCapabilityDefinition;
		lineIds: readonly string[];
		save: GameSave;
		targetItemInstanceId: string;
	}
}

export const readRuntimeLineViewsFromGameSave = ({
	config,
	maxQueueSize,
	nowMs,
	producerDefinition,
	lineIds,
	save,
	targetItemInstanceId,
}: readRuntimeLineViewsFromGameSave.Props): LineView[] => {
	const queueState = readRuntimeProducerQueueViewState({
		maxQueueSize,
		nowMs,
		save,
		targetItemInstanceId,
	});
	const visibleLineIds = readVisibleLineIds({
		config,
		nowMs,
		producerDefinition,
		itemInstanceId: targetItemInstanceId,
		lineIds,
		save,
	});
	const defaultSelection = readRuntimeLineDefaultSelection({
		itemInstanceId: targetItemInstanceId,
		save,
		visibleLineIds,
	});

	return readLineIdsVisibleOrCurrentlyQueued({
		producerJobs: queueState.jobs,
		lineIds,
		visibleLineIds,
	}).flatMap((lineId) => {
		const line = readLineDefinition({
			producerDefinition,
			lineId,
		});
		if (!line) return [];

		const view = readRuntimeLineViewFromDefinition({
			config,
			defaultSelection,
			line,
			lineId,
			maxQueueSize,
			nowMs,
			queueState,
			save,
			targetItemInstanceId,
		});

		return view
			? [
					view,
				]
			: [];
	});
};
