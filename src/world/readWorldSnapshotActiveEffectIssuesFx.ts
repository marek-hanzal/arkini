import { Effect } from "effect";
import type { WorldActiveEffectFacts } from "~/world/WorldActiveEffectFacts";
import type { WorldCheckIssue } from "~/world/WorldCheckIssue";
import type { WorldProducerJobFacts } from "~/world/WorldProducerJobFacts";
import { readProducerJobFactsByIdFx } from "~/world/readProducerJobFactsByIdFx";
import type { WorldSnapshotValidationScope } from "~/world/WorldSnapshotValidationScope";

const createActiveEffectDeliveryJobIssueFx = Effect.fn(
	"readWorldSnapshotActiveEffectIssuesFx.createActiveEffectDeliveryJobIssueFx",
)(function* ({
	effectFacts,
	producerJobFacts,
}: {
	effectFacts: WorldActiveEffectFacts;
	producerJobFacts: WorldProducerJobFacts;
}) {
	if (!producerJobFacts.job.delivery) return [];
	return [
		{
			code: "active_effect_delivery_job_linked",
			entity: {
				id: effectFacts.effect.id,
				kind: "activeEffect",
			},
			evidence: {
				producerJobId: effectFacts.producerJobId,
				producerStatus: producerJobFacts.status,
				status: effectFacts.status,
			},
			message: `Active effect "${effectFacts.effect.id}" is linked to completed delivery job "${effectFacts.producerJobId}".`,
			severity: "error",
		},
	] satisfies WorldCheckIssue[];
});

const createActiveEffectApplyStateIssueFx = Effect.fn(
	"readWorldSnapshotActiveEffectIssuesFx.createActiveEffectApplyStateIssueFx",
)(function* ({
	effectFacts,
	producerJobFacts,
}: {
	effectFacts: WorldActiveEffectFacts;
	producerJobFacts: WorldProducerJobFacts;
}) {
	if (effectFacts.status !== "active") return [];
	if (producerJobFacts.status === "running" || producerJobFacts.status === "ready") return [];
	return [
		{
			code: "active_effect_apply_state_invalid",
			entity: {
				id: effectFacts.effect.id,
				kind: "activeEffect",
			},
			evidence: {
				producerJobId: effectFacts.producerJobId,
				producerStatus: producerJobFacts.status,
				status: effectFacts.status,
			},
			message: `Active effect "${effectFacts.effect.id}" applies while linked producer job "${effectFacts.producerJobId}" is ${producerJobFacts.status}.`,
			severity: "error",
		},
	] satisfies WorldCheckIssue[];
});

const createActiveEffectProducerIssueFx = Effect.fn(
	"readWorldSnapshotActiveEffectIssuesFx.createActiveEffectProducerIssueFx",
)(function* ({
	effectFacts,
	scope,
}: {
	effectFacts: WorldActiveEffectFacts;
	scope: WorldSnapshotValidationScope;
}) {
	if (!effectFacts.producerJobId) return [];
	const producerJobFactsById = yield* readProducerJobFactsByIdFx(scope);
	const producerJobFacts = producerJobFactsById.get(effectFacts.producerJobId);
	if (!producerJobFacts) return [];
	const deliveryIssues = yield* createActiveEffectDeliveryJobIssueFx({
		effectFacts,
		producerJobFacts,
	});
	return deliveryIssues.length > 0
		? deliveryIssues
		: yield* createActiveEffectApplyStateIssueFx({
				effectFacts,
				producerJobFacts,
			});
});

export const readWorldSnapshotActiveEffectIssuesFx = Effect.fn(
	"readWorldSnapshotActiveEffectIssuesFx",
)(function* (scope: WorldSnapshotValidationScope) {
	const issues: WorldCheckIssue[] = [];
	for (const effectFacts of scope.facts.activeEffects) {
		issues.push(
			...(yield* createActiveEffectProducerIssueFx({
				effectFacts,
				scope,
			})),
		);
	}
	return issues;
});
