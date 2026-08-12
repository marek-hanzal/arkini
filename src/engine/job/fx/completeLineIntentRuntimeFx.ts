import { Effect, Result } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { settleItemDeliveryRuntimeFx } from "~/engine/delivery/write/settleItemDeliveryRuntimeFx";
import { GameEventEnumSchema } from "~/engine/event/schema/GameEventEnumSchema";
import type { GameEventSchema } from "~/engine/event/schema/GameEventSchema";
import { autofillLineInputsRuntimeFx } from "~/engine/input/write/autofillLineInputsFx";
import { attemptJobCompletionFx } from "~/engine/job/fx/attemptJobCompletionFx";
import { enqueueLineRuntimeFx } from "~/engine/job/fx/enqueueLineRuntimeFx";
import { startQueuedLineRuntimeFx } from "~/engine/job/fx/startQueuedLineRuntimeFx";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import { placeRuntimeItemFx } from "~/engine/placement/fx/placeRuntimeItemFx";
import { RuntimeFx } from "~/engine/runtime/context/RuntimeFx";
import type { GridRuntimeItemSchema } from "~/engine/runtime/schema/GridRuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { RuntimeTimePolicyFx } from "~/engine/tick/context/RuntimeTimePolicyFx";

export namespace completeLineIntentRuntimeFx {
	export interface Props {
		readonly lineId: IdSchema.Type;
		readonly ownerItemId: IdSchema.Type;
		readonly runtime: RuntimeSchema.Type;
	}

	export type AttemptStage =
		| "autofill"
		| "complete"
		| "enqueue"
		| "place-owner"
		| "settle-input"
		| "start";

	export interface Attempt {
		readonly causeTag: string;
		readonly missingQuantity?: number;
		readonly ownerRuntimeItemId: IdSchema.Type;
		readonly relatedRuntimeItemId?: IdSchema.Type;
		readonly stage: AttemptStage;
	}

	export type Result =
		| {
				readonly type: "blocked";
				readonly attempt: readonly Attempt[];
				readonly reason: "candidate-rejected" | "owner-unavailable";
		  }
		| {
				readonly type: "completed";
				readonly elapsedMs: number;
				readonly events: readonly GameEventSchema.Type[];
				readonly jobId: IdSchema.Type;
				readonly ownerRuntimeItemId: IdSchema.Type;
				readonly runtime: RuntimeSchema.Type;
		  }
		| {
				readonly type: "unsupported";
				readonly reason: "timed-work-not-instant";
				readonly runtimeMs: number;
		  };
}

const readFailureTag = (failure: unknown) =>
	typeof failure === "object" &&
	failure !== null &&
	"_tag" in failure &&
	typeof failure._tag === "string"
		? failure._tag
		: "UnknownEngineFailure";

const readOwnerScopeRank = (item: GridRuntimeItemSchema.Type) =>
	item.location.scope === LocationScopeEnumSchema.enum.Board ? 0 : 1;

const compareOwnerCandidates = (
	left: GridRuntimeItemSchema.Type,
	right: GridRuntimeItemSchema.Type,
) => {
	const leftCharges = left.remainingCharges ?? left.item.charges?.amount ?? -1;
	const rightCharges = right.remainingCharges ?? right.item.charges?.amount ?? -1;
	return (
		readOwnerScopeRank(left) - readOwnerScopeRank(right) ||
		rightCharges - leftCharges ||
		right.quantity - left.quantity ||
		left.location.position.y - right.location.position.y ||
		left.location.position.x - right.location.position.x ||
		left.id.localeCompare(right.id)
	);
};

const readPlacedOwnerRuntimeItemId = ({
	events,
	ownerItemId,
	runtime,
}: {
	readonly events: readonly GameEventSchema.Type[];
	readonly ownerItemId: IdSchema.Type;
	readonly runtime: RuntimeSchema.Type;
}) => {
	for (const event of events.slice().reverse()) {
		if (
			(event.type === GameEventEnumSchema.enum.ItemPlaced ||
				event.type === GameEventEnumSchema.enum.ItemSpawned ||
				event.type === GameEventEnumSchema.enum.ItemStacked) &&
			event.canonicalItemId === ownerItemId &&
			event.location.scope === LocationScopeEnumSchema.enum.Board &&
			event.location.space === runtime.currentSpace
		) {
			return event.itemId;
		}
	}
	return undefined;
};

const readBoardOwner = ({
	ownerItemId,
	preferredRuntimeItemId,
	runtime,
}: {
	readonly ownerItemId: IdSchema.Type;
	readonly preferredRuntimeItemId: IdSchema.Type;
	readonly runtime: RuntimeSchema.Type;
}) => {
	const candidates = runtime.items
		.filter(
			(item): item is GridRuntimeItemSchema.Type =>
				item.item.id === ownerItemId &&
				item.location.scope === LocationScopeEnumSchema.enum.Board &&
				item.location.space === runtime.currentSpace,
		)
		.slice()
		.sort(compareOwnerCandidates);
	return candidates.find((candidate) => candidate.id === preferredRuntimeItemId) ?? candidates[0];
};

/**
 * Executes one authored line intent against an immutable runtime branch.
 *
 * Candidate choice belongs to this engine boundary, while queue admission, Autofill,
 * delivery settlement, reservations, charges and completion remain canonical transitions.
 * A rejected candidate is discarded whole; only a completed branch escapes.
 */
export const completeLineIntentRuntimeFx = Effect.fn("completeLineIntentRuntimeFx")(function* ({
	lineId,
	ownerItemId,
	runtime,
}: completeLineIntentRuntimeFx.Props) {
	const candidates = runtime.items
		.filter(
			(item): item is GridRuntimeItemSchema.Type =>
				item.item.id === ownerItemId &&
				((item.location.scope === LocationScopeEnumSchema.enum.Board &&
					item.location.space === runtime.currentSpace) ||
					item.location.scope === LocationScopeEnumSchema.enum.Inventory),
		)
		.slice()
		.sort(compareOwnerCandidates);
	if (candidates.length === 0) {
		return {
			type: "blocked",
			attempt: [],
			reason: "owner-unavailable",
		} satisfies completeLineIntentRuntimeFx.Result;
	}

	const attempts: completeLineIntentRuntimeFx.Attempt[] = [];
	const timePolicy = yield* RuntimeTimePolicyFx;
	for (const candidate of candidates) {
		let candidateRuntime = runtime;
		let ownerRuntimeItemId = candidate.id;
		const events: GameEventSchema.Type[] = [];

		if (candidate.location.scope === LocationScopeEnumSchema.enum.Inventory) {
			const placement = yield* Effect.result(
				placeRuntimeItemFx({
					itemId: candidate.id,
					origin: {
						position: {
							x: 0,
							y: 0,
						},
						scope: LocationScopeEnumSchema.enum.Board,
						space: runtime.currentSpace,
					},
					originItemId: candidate.id,
					runtime,
				}),
			);
			if (Result.isFailure(placement)) {
				attempts.push({
					causeTag: readFailureTag(placement.failure),
					ownerRuntimeItemId: candidate.id,
					stage: "place-owner",
				});
				continue;
			}
			candidateRuntime = placement.success.runtime;
			events.push(...placement.success.events);
			ownerRuntimeItemId =
				readPlacedOwnerRuntimeItemId({
					events: placement.success.events,
					ownerItemId,
					runtime: candidateRuntime,
				}) ?? candidate.id;
		}

		const owner = readBoardOwner({
			ownerItemId,
			preferredRuntimeItemId: ownerRuntimeItemId,
			runtime: candidateRuntime,
		});
		if (owner === undefined) {
			attempts.push({
				causeTag: "OwnerPlacementMissing",
				ownerRuntimeItemId: candidate.id,
				stage: "place-owner",
			});
			continue;
		}
		ownerRuntimeItemId = owner.id;

		const admission = yield* Effect.result(
			enqueueLineRuntimeFx({
				lineId,
				ownerItemId: owner.id,
				runtime: candidateRuntime,
			}),
		);
		if (Result.isFailure(admission)) {
			attempts.push({
				causeTag: readFailureTag(admission.failure),
				ownerRuntimeItemId: candidate.id,
				stage: "enqueue",
			});
			continue;
		}
		candidateRuntime = admission.success.runtime;
		events.push(...admission.success.events);

		const autofill = yield* Effect.result(
			autofillLineInputsRuntimeFx({
				lineId,
				ownerItemId: owner.id,
				runtime: candidateRuntime,
			}),
		);
		if (Result.isFailure(autofill)) {
			attempts.push({
				causeTag: readFailureTag(autofill.failure),
				ownerRuntimeItemId: candidate.id,
				stage: "autofill",
			});
			continue;
		}
		if (autofill.success.result.remainingMissingQuantity > 0) {
			attempts.push({
				causeTag: "LineMaterialsMissing",
				missingQuantity: autofill.success.result.remainingMissingQuantity,
				ownerRuntimeItemId: candidate.id,
				stage: "autofill",
			});
			continue;
		}
		candidateRuntime = autofill.success.runtime;
		events.push(...autofill.success.events);

		let settlementRejected = false;
		for (const deliveryItemId of autofill.success.result.deliveryItemIds) {
			while (true) {
				const delivery = candidateRuntime.items.find(
					(item) =>
						item.id === deliveryItemId &&
						item.location.scope === LocationScopeEnumSchema.enum.Delivery,
				);
				if (
					delivery === undefined ||
					delivery.location.scope !== LocationScopeEnumSchema.enum.Delivery
				) {
					break;
				}
				const settled = yield* Effect.result(
					settleItemDeliveryRuntimeFx({
						generation: delivery.location.generation,
						itemId: delivery.id,
						runtime: candidateRuntime,
					}),
				);
				if (Result.isFailure(settled)) {
					attempts.push({
						causeTag: readFailureTag(settled.failure),
						ownerRuntimeItemId: candidate.id,
						relatedRuntimeItemId: delivery.id,
						stage: "settle-input",
					});
					settlementRejected = true;
					break;
				}
				if (
					settled.success.runtime === candidateRuntime &&
					settled.success.result.status === "ignored"
				) {
					attempts.push({
						causeTag: "DeliverySettlementStalled",
						ownerRuntimeItemId: candidate.id,
						relatedRuntimeItemId: delivery.id,
						stage: "settle-input",
					});
					settlementRejected = true;
					break;
				}
				candidateRuntime = settled.success.runtime;
				events.push(...settled.success.events);
			}
			if (settlementRejected) break;
		}
		if (settlementRejected) continue;

		const started = yield* Effect.result(
			startQueuedLineRuntimeFx({
				lineId,
				ownerItemId: owner.id,
				queueRequestId: admission.success.request.id,
				runtime: candidateRuntime,
			}).pipe(
				Effect.provideService(RuntimeFx, {
					read: Effect.succeed(candidateRuntime),
				}),
			),
		);
		if (Result.isFailure(started)) {
			attempts.push({
				causeTag: readFailureTag(started.failure),
				ownerRuntimeItemId: candidate.id,
				stage: "start",
			});
			continue;
		}
		if (started.success.type !== "started") {
			attempts.push({
				causeTag: `LineStart:${started.success.type}`,
				...(started.success.type === "incomplete"
					? {
							missingQuantity: started.success.missingQuantity,
						}
					: {}),
				ownerRuntimeItemId: candidate.id,
				stage: "start",
			});
			continue;
		}
		const job = started.success.job;
		if (
			job.durationMs > 0 &&
			!(yield* timePolicy.completeTimedWorkInstantly({
				runtime: started.success.runtime,
			}))
		) {
			return {
				type: "unsupported",
				reason: "timed-work-not-instant",
				runtimeMs: job.durationMs,
			} satisfies completeLineIntentRuntimeFx.Result;
		}

		const readyRuntime = {
			...started.success.runtime,
			jobs: started.success.runtime.jobs.map((candidateJob) =>
				candidateJob.id === job.id
					? {
							...candidateJob,
							remainingMs: 0,
						}
					: candidateJob,
			),
		} satisfies RuntimeSchema.Type;
		const completion = yield* attemptJobCompletionFx({
			jobId: job.id,
			runtime: readyRuntime,
		}).pipe(
			Effect.provideService(RuntimeFx, {
				read: Effect.succeed(readyRuntime),
			}),
		);
		if (completion.type === "blocked") {
			attempts.push({
				causeTag: completion.error._tag,
				ownerRuntimeItemId: candidate.id,
				stage: "complete",
			});
			continue;
		}

		return {
			type: "completed",
			elapsedMs: job.durationMs,
			events: [
				...events,
				{
					type: GameEventEnumSchema.enum.JobStarted,
					jobId: job.id,
					ownerItemId: job.ownerItemId,
					lineId: job.lineId,
				},
				...started.success.events,
				{
					type: GameEventEnumSchema.enum.JobCompleted,
					jobId: job.id,
					ownerItemId: job.ownerItemId,
					lineId: job.lineId,
				},
				...completion.events,
			],
			jobId: job.id,
			ownerRuntimeItemId,
			runtime: completion.runtime,
		} satisfies completeLineIntentRuntimeFx.Result;
	}

	return {
		type: "blocked",
		attempt: attempts,
		reason: "candidate-rejected",
	} satisfies completeLineIntentRuntimeFx.Result;
});
