import { settleTerminalItemRuntimeFx } from "~/item-terminal/fx/settleTerminalItemRuntimeFx";
import { Effect } from "effect";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { EngineFact } from "~/game-event/type/EngineFact";
import { readItemPhysicalContextFx } from "~/item-location/fx/readItemPhysicalContextFx";
import { readItemTerminalStateFn } from "~/item-terminal/fn/readItemTerminalStateFn";
import { selectTriggeredLineFx } from "~/line-trigger/fx/selectTriggeredLineFx";
import { LineTriggerEnumSchema } from "~/production-line/schema/LineTriggerEnumSchema";
import { releaseOwnerInputsFx } from "~/production-input/fx/releaseOwnerInputsFx";
import { readLineInputAutofillCoverageFx } from "~/production-input/fx/readLineInputAutofillCoverageFx";
import { enqueueLineRuntimeFx } from "~/production-job/fx/enqueueLineRuntimeFx";
import { abortJobRuntimeFx } from "~/production-job/fx/abortJobRuntimeFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { PlacementUnavailableError } from "~/item-placement/error/PlacementUnavailableError";

interface AttemptTerminalItemProps {
	itemId: IdSchema.Type;
	runtime: RuntimeSchema.Type;
	excludedSourceItemIds?: ReadonlySet<IdSchema.Type>;
}

type AttemptTerminalItemResult =
	| {
			type: "blocked";
			error: PlacementUnavailableError;
			runtime: RuntimeSchema.Type;
	  }
	| {
			type: "settled" | "queued";
			facts: readonly EngineFact[];
			runtime: RuntimeSchema.Type;
			claimedSourceItemIds: readonly IdSchema.Type[];
	  };

interface CompleteTerminalItemTransitionResult {
	readonly type: "settled" | "queued";
	readonly facts: readonly EngineFact[];
	readonly runtime: RuntimeSchema.Type;
	readonly claimedSourceItemIds?: readonly IdSchema.Type[];
}

/** Schedules one terminal line as ordinary work, or removes an owner with no eligible work. */
const completeTerminalItemTransitionFx = Effect.fn("completeTerminalItemTransitionFx")(function* ({
	itemId,
	runtime,
	excludedSourceItemIds,
}: AttemptTerminalItemProps) {
	const item = runtime.items.find((candidate) => candidate.id === itemId);
	if (item === undefined)
		return yield* Effect.die(new Error(`Terminal item ${itemId} is missing.`));
	const terminal = readItemTerminalStateFn(item);
	if (terminal === undefined)
		return yield* Effect.die(new Error(`Item ${item.id} is not ready to terminate.`));
	const context = yield* readItemPhysicalContextFx({
		item,
		runtime,
	});

	const selectedLine = yield* selectTriggeredLineFx({
		item,
		runtime,
		trigger: LineTriggerEnumSchema.enum["item-termination"],
		origin: context.origin,
		randomSeed: `serakki:terminal-line:v1:${item.id}:${item.item.uid}`,
	});
	const force = terminal.mode === "kill-switch";
	// Material owned by another job cannot run its own Board job. Its expiry must
	// settle immediately so the parent job can abort before advancing again.
	if (item.location.scope !== "board") {
		const expiry = yield* settleTerminalItemRuntimeFx({
			cause: terminal.cause,
			removalMode: force ? "kill-switch" : undefined,
			item,
			origin: context.origin,
			outcome: selectedLine?.outcome,
			randomSeed: [
				`serakki:terminal:${terminal.cause}`,
				"v1",
				item.id,
				item.item.uid,
			].join(":"),
			runtime,
		});
		const release = force
			? {
					runtime: expiry.runtime,
					events: [],
				}
			: yield* releaseOwnerInputsFx({
					owner: item,
					origin: context.origin,
					runtime: expiry.runtime,
				});
		return {
			type: "settled",
			facts: [
				...expiry.facts,
				...release.events,
			],
			runtime: release.runtime,
		} satisfies CompleteTerminalItemTransitionResult;
	}
	let draft: RuntimeSchema.Type = {
		...runtime,
		jobQueue: runtime.jobQueue.filter((request) => request.ownerItemId !== item.id),
	};
	const cancelledFacts: EngineFact[] = [];
	if (force) {
		for (const job of runtime.jobs.filter((candidate) => candidate.ownerItemId === item.id)) {
			if (!draft.jobs.some((candidate) => candidate.id === job.id)) continue;
			const aborted = yield* abortJobRuntimeFx({
				jobId: job.id,
				reason: "owner-removed",
				overflow: "discard",
				runtime: draft,
			});
			draft = aborted.runtime;
			cancelledFacts.push(...aborted.facts);
		}
	}
	const currentOwner = draft.items.find((candidate) => candidate.id === item.id);
	if (currentOwner === undefined)
		return {
			type: "settled",
			facts: cancelledFacts,
			runtime: draft,
		} satisfies CompleteTerminalItemTransitionResult;
	if (selectedLine !== undefined) {
		const queued = yield* Effect.gen(function* () {
			const coverage = yield* readLineInputAutofillCoverageFx({
				ownerItemId: item.id,
				lineUid: selectedLine.uid,
				runtime: draft,
				excludedSourceItemIds,
			});
			if (coverage.type === "incomplete") return undefined;
			const request = yield* enqueueLineRuntimeFx({
				ownerItemId: item.id,
				lineUid: selectedLine.uid,
				runtime: draft,
				trigger: LineTriggerEnumSchema.enum["item-termination"],
			});
			return {
				request,
				claimedSourceItemIds: coverage.plan.entry.map((entry) => entry.sourceItemId),
			};
		}).pipe(
			Effect.catchTags({
				JobQueueFullError: () => Effect.succeed(undefined),
				LineRunUnavailableError: () => Effect.succeed(undefined),
				ItemNotOnBoardError: () => Effect.succeed(undefined),
			}),
		);
		if (queued !== undefined)
			return {
				type: "queued",
				facts: [
					...cancelledFacts,
					...queued.request.events,
				],
				runtime: queued.request.runtime,
				claimedSourceItemIds: queued.claimedSourceItemIds,
			} satisfies CompleteTerminalItemTransitionResult;
	}
	const expiry = yield* settleTerminalItemRuntimeFx({
		cause: terminal.cause,
		removalMode: force ? "kill-switch" : undefined,
		item: currentOwner,
		origin: context.origin,
		randomSeed: [
			`serakki:terminal:${terminal.cause}`,
			"v1",
			item.id,
			item.item.uid,
		].join(":"),
		runtime: draft,
	});
	const release = force
		? {
				runtime: expiry.runtime,
				events: [],
			}
		: yield* releaseOwnerInputsFx({
				owner: item,
				origin: context.origin,
				runtime: expiry.runtime,
			});

	return {
		type: "settled",
		facts: [
			...cancelledFacts,
			...expiry.facts,
			...release.events,
		],
		runtime: release.runtime,
	} satisfies CompleteTerminalItemTransitionResult;
});

/** Resolves one ready terminal exit and keeps only expected placement failures local. */
export const attemptTerminalItemFx = Effect.fn("attemptTerminalItemFx")(function* ({
	itemId,
	runtime,
	excludedSourceItemIds,
}: AttemptTerminalItemProps) {
	return yield* completeTerminalItemTransitionFx({
		itemId,
		runtime,
		excludedSourceItemIds,
	}).pipe(
		Effect.map(
			(completion) =>
				({
					type: completion.type,
					facts: completion.facts,
					runtime: completion.runtime,
					claimedSourceItemIds: completion.claimedSourceItemIds ?? [],
				}) satisfies AttemptTerminalItemResult,
		),
		Effect.catchTag("PlacementUnavailableError", (error) =>
			Effect.succeed({
				type: "blocked",
				error,
				runtime,
			} satisfies AttemptTerminalItemResult),
		),
	);
});
