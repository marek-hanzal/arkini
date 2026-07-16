import type { LineView } from "~/board/view/LineViewSchema";
import type { GameConfig } from "~/config/GameConfigTypes";
import {
	readLineDefinition,
	type GameProducerCapabilityDefinition,
} from "~/config/GameItemCapabilities";
import type { GameSave, GameSaveProducerJob } from "~/engine/model/GameSaveSchema";
import { readVisibleLineIds } from "~/producer/readVisibleLineIds";
import { readRuntimeLineDefaultSelection } from "~/play/game-engine-bridge/readRuntimeLineDefaultSelection";
import { readRuntimeLineViewFromDefinition } from "~/play/game-engine-bridge/readRuntimeLineViewFromDefinition";
import { readRuntimeProducerQueueViewState } from "~/play/game-engine-bridge/readRuntimeProducerQueueViewState";

const readLineIdsVisibleOrCurrentlyQueued = ({
	lineIds,
	producerJobs,
	visibleLineIds,
}: {
	lineIds: readonly string[];
	producerJobs: readonly GameSaveProducerJob[];
	visibleLineIds: readonly string[];
}) => {
	const visible = new Set(visibleLineIds);
	const jobLineIds = new Set(producerJobs.map((job) => job.lineId));

	return lineIds.filter((lineId) => visible.has(lineId) || jobLineIds.has(lineId));
};

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
