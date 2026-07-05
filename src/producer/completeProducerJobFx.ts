import { Effect } from "effect";
import type { GameConfig } from "~/config/GameConfigTypes";
import { createMissingProducerJobResult } from "~/producer/ProducerJobCompletionEvents";
import { completeLiveProducerJobFx } from "~/producer/completeLiveProducerJobFx";
import type { GameSave, GameSaveProducerJob } from "~/engine/model/GameSaveSchema";
import { readLiveProducerJobFx } from "~/producer/readLiveProducerJobFx";

export namespace completeProducerJobFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		job: GameSaveProducerJob;
		nowMs: number;
	}
}

const completeProducerJobProgramFx = Effect.fn("completeProducerJobProgramFx")(function* (
	scope: completeProducerJobFx.Props,
) {
	const liveJob = yield* readLiveProducerJobFx(scope);
	if (!liveJob) {
		return createMissingProducerJobResult({
			save: scope.save,
		});
	}

	return yield* completeLiveProducerJobFx({
		liveJob,
		scope,
	});
});

export const completeProducerJobFx = Effect.fn("completeProducerJobFx")(function* (
	props: completeProducerJobFx.Props,
) {
	return yield* completeProducerJobProgramFx(props);
});
