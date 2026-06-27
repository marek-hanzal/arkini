import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameSave, GameSaveProducerJob } from "~/v0/game/engine/model/GameSaveSchema";
import { readStoredRequirementQuantitiesFx } from "~/v0/game/requirements/readStoredRequirementQuantitiesFx";
import { readWorldRequirementFactsFx } from "~/v0/game/world/readWorldRequirementFactsFx";
import { readWorldProducerJobSubjectFx } from "~/v0/game/world/readWorldProducerJobSubjectFx";
import type { WorldProducerRequirementFacts } from "~/v0/game/world/WorldProducerRequirementFacts";

export namespace readWorldProducerRequirementFactsFx {
	export interface Props {
		config: GameConfig;
		job: GameSaveProducerJob;
		save: GameSave;
	}
}

export const readWorldProducerRequirementFactsFx = Effect.fn("readWorldProducerRequirementFactsFx")(
	function* ({ config, job, save }: readWorldProducerRequirementFactsFx.Props) {
		const subject = yield* readWorldProducerJobSubjectFx({
			config,
			job,
			save,
		});
		const storedItems = yield* readStoredRequirementQuantitiesFx({
			save,
			targetItemInstanceId: job.producerItemInstanceId,
		});
		const requirementFacts = yield* readWorldRequirementFactsFx({
			requirements: subject.requirements,
			save,
			storedItems,
			targetItemInstanceId: job.producerItemInstanceId,
		});

		return {
			jobId: job.id,
			producerItemInstanceId: job.producerItemInstanceId,
			ready: requirementFacts.every((fact) => fact.status === "ok"),
			requirements: requirementFacts,
		} satisfies WorldProducerRequirementFacts;
	},
);
