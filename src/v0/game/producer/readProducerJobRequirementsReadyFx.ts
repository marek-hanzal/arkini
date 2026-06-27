import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameSave, GameSaveProducerJob } from "~/v0/game/engine/model/GameSaveSchema";
import { readWorldProducerRequirementFactsFx } from "~/v0/game/world/readWorldProducerRequirementFactsFx";

export namespace readProducerJobRequirementsReadyFx {
	export interface Props {
		config: GameConfig;
		job: GameSaveProducerJob;
		save: GameSave;
	}
}

export const readProducerJobRequirementsReadyFx = Effect.fn("readProducerJobRequirementsReadyFx")(
	function* ({ config, job, save }: readProducerJobRequirementsReadyFx.Props) {
		const requirementFacts = yield* readWorldProducerRequirementFactsFx({
			config,
			job,
			save,
		});

		return requirementFacts.ready;
	},
);
