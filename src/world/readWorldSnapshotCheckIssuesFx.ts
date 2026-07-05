import { Effect } from "effect";
import { match } from "ts-pattern";
import { readWorldSnapshotActiveEffectIssuesFx } from "~/world/readWorldSnapshotActiveEffectIssuesFx";
import { readWorldSnapshotJobDeliveryIssuesFx } from "~/world/readWorldSnapshotJobDeliveryIssuesFx";
import { readWorldSnapshotProducerQueueIssuesFx } from "~/world/readWorldSnapshotProducerQueueIssuesFx";
import { readWorldSnapshotReplacementSafetyIssuesFx } from "~/world/readWorldSnapshotReplacementSafetyIssuesFx";
import type { WorldSnapshotCheckId } from "~/world/WorldSnapshotCheckId";
import type { WorldSnapshotValidationScope } from "~/world/WorldSnapshotValidationScope";

export const readWorldSnapshotCheckIssuesFx = Effect.fn("readWorldSnapshotCheckIssuesFx")(
	function* ({
		checkId,
		scope,
	}: {
		checkId: WorldSnapshotCheckId;
		scope: WorldSnapshotValidationScope;
	}) {
		return yield* match(checkId)
			.with("job-delivery", () => readWorldSnapshotJobDeliveryIssuesFx(scope))
			.with("producer-queues", () => readWorldSnapshotProducerQueueIssuesFx(scope))
			.with("active-effects", () => readWorldSnapshotActiveEffectIssuesFx(scope))
			.with("replacement-safety", () => readWorldSnapshotReplacementSafetyIssuesFx(scope))
			.exhaustive();
	},
);
