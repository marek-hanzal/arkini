import { Effect } from "effect";
import { match } from "ts-pattern";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { readWorldSnapshotActiveEffectIssuesFx } from "~/world/readWorldSnapshotActiveEffectIssuesFx";
import { readWorldSnapshotJobDeliveryIssuesFx } from "~/world/readWorldSnapshotJobDeliveryIssuesFx";
import { readWorldSnapshotProducerQueueIssuesFx } from "~/world/readWorldSnapshotProducerQueueIssuesFx";
import { readWorldSnapshotReplacementSafetyIssuesFx } from "~/world/readWorldSnapshotReplacementSafetyIssuesFx";
import type { WorldSnapshotCheckId } from "~/world/WorldSnapshotCheckId";
import type { WorldSnapshotFacts } from "~/world/WorldSnapshotFacts";

export const readWorldSnapshotCheckIssuesFx = Effect.fn("readWorldSnapshotCheckIssuesFx")(
	function* ({
		checkId,
		facts,
		save,
	}: {
		checkId: WorldSnapshotCheckId;
		facts: WorldSnapshotFacts;
		save: GameSave;
	}) {
		return yield* match(checkId)
			.with("job-delivery", () => readWorldSnapshotJobDeliveryIssuesFx({ facts }))
			.with("producer-queues", () => readWorldSnapshotProducerQueueIssuesFx({ facts }))
			.with("active-effects", () => readWorldSnapshotActiveEffectIssuesFx({ facts }))
			.with("replacement-safety", () => readWorldSnapshotReplacementSafetyIssuesFx({ facts, save }))
			.exhaustive();
	},
);
