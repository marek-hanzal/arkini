import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { readWorldActiveEffectFacts } from "~/v0/game/world/readWorldActiveEffectFacts";
import { readWorldCraftJobFacts } from "~/v0/game/world/readWorldCraftJobFacts";
import { readWorldProducerJobFacts } from "~/v0/game/world/readWorldProducerJobFacts";
import { readWorldProcessableJobFacts } from "~/v0/game/world/readWorldProcessableJobFacts";
import { readWorldReplacementSafetyFacts } from "~/v0/game/world/readWorldReplacementSafetyFacts";
import { readWorldWakePlanFx } from "~/v0/game/world/readWorldWakePlanFx";
import type { WorldSnapshotFacts } from "~/v0/game/world/WorldSnapshotFacts";

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
