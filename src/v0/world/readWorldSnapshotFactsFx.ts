import { Effect } from "effect";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { readWorldActiveEffectFacts } from "~/world/readWorldActiveEffectFacts";
import { readWorldCraftJobFacts } from "~/world/readWorldCraftJobFacts";
import { readWorldProducerJobFacts } from "~/world/readWorldProducerJobFacts";
import { readWorldProcessableJobFacts } from "~/world/readWorldProcessableJobFacts";
import { readWorldReplacementSafetyFacts } from "~/world/readWorldReplacementSafetyFacts";
import { readWorldWakePlanFx } from "~/world/readWorldWakePlanFx";
import type { WorldSnapshotFacts } from "~/world/WorldSnapshotFacts";

export namespace readWorldSnapshotFactsFx {
	export interface Props {
		config: GameConfig;
		nowMs: number;
		save: GameSave;
	}
}

export const readWorldSnapshotFactsFx = Effect.fn("readWorldSnapshotFactsFx")(function* ({
	config,
	nowMs,
	save,
}: readWorldSnapshotFactsFx.Props) {
	const producerJobs = readWorldProducerJobFacts({
		nowMs,
		save,
	});
	return {
		activeEffects: readWorldActiveEffectFacts({
			config,
			nowMs,
			save,
		}),
		craftJobs: readWorldCraftJobFacts({
			nowMs,
			save,
		}),
		processableJobs: readWorldProcessableJobFacts({
			config,
			nowMs,
			save,
		}),
		producerJobs,
		replacementSafety: readWorldReplacementSafetyFacts({
			save,
		}),
		wakePlan: yield* readWorldWakePlanFx({
			config,
			nowMs,
			save,
		}),
	} satisfies WorldSnapshotFacts;
});
