import { Effect } from "effect";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { EngineFact } from "~/game-event/type/EngineFact";
import { readItemScheduleFn } from "~/item-schedule/fn/readItemScheduleFn";
import { resolveItemScheduleEnabledFx } from "~/item-schedule/fx/resolveItemScheduleEnabledFx";
import { selectTriggeredLineFx } from "~/line-trigger/fx/selectTriggeredLineFx";
import { enqueueLineRuntimeFx } from "~/production-job/fx/enqueueLineRuntimeFx";
import { SimulationStepMs } from "~/simulation-time/constant/SimulationStepMs";
import { LineTriggerEnumSchema } from "~/production-line/schema/LineTriggerEnumSchema";
import { readLineInputAutofillCoverageFx } from "~/production-input/fx/readLineInputAutofillCoverageFx";

/** Advances boundary identities only; a pulse admits ordinary intent before closing its final lifetime. */
export const advanceItemSchedulesFx = Effect.fn("advanceItemSchedulesFx")(function* ({
	stepStart,
	runtime,
}: {
	readonly stepStart: RuntimeSchema.Type;
	readonly runtime: RuntimeSchema.Type;
}) {
	let draft = runtime;
	const facts: EngineFact[] = [];
	let dispatched = false;
	// One Board source cannot satisfy two owners pulsing in the same scheduler pass.
	const claimedSourceItemIds = new Set<IdSchema.Type>();
	const owners = stepStart.items
		.filter((item) => item.schedule !== undefined)
		.sort((a, b) => a.id.localeCompare(b.id));
	for (const snapshot of owners) {
		const item = draft.items.find((candidate) => candidate.id === snapshot.id);
		const config = readItemScheduleFn(snapshot.item);
		const state = item?.schedule;
		if (
			item === undefined ||
			config === undefined ||
			state === undefined ||
			item.remainingUnits === 0 ||
			state.remainingDurationMs === 0 ||
			!(yield* resolveItemScheduleEnabledFx({
				item: snapshot,
				runtime: stepStart,
			}))
		)
			continue;
		const elapsed = Math.min(SimulationStepMs, state.remainingDurationMs ?? SimulationStepMs);
		const phase =
			state.remainingIntervalMs === undefined
				? undefined
				: state.remainingIntervalMs - elapsed;
		const expired =
			state.remainingDurationMs !== undefined && state.remainingDurationMs <= elapsed;
		const pulse =
			phase !== undefined &&
			phase <= 0 &&
			!(expired && item.item.terminationMode === "kill-switch");
		if (pulse) {
			// A rejected choice consumes this pulse; never retry another line or mutate accepted work.
			const attempt = yield* Effect.gen(function* () {
				const line = yield* selectTriggeredLineFx({
					item,
					runtime: draft,
					trigger: LineTriggerEnumSchema.enum["clock-interval"],
					randomSeed: `serakki:clock-interval:v1:${item.id}:${item.item.uid}:${item.schedule?.pulseSequence ?? 0}`,
				});
				if (line === undefined) return undefined;
				const coverage = yield* readLineInputAutofillCoverageFx({
					ownerItemId: item.id,
					lineUid: line.uid,
					runtime: draft,
					excludedSourceItemIds: claimedSourceItemIds,
				});
				if (coverage.type === "incomplete") return undefined;
				const queued = yield* enqueueLineRuntimeFx({
					ownerItemId: item.id,
					lineUid: line.uid,
					runtime: draft,
					trigger: LineTriggerEnumSchema.enum["clock-interval"],
				});
				return {
					queued,
					claimed: coverage.plan.entry.map((entry) => entry.sourceItemId),
				};
			}).pipe(
				Effect.catchTags({
					JobQueueFullError: () => Effect.succeed(undefined),
					LineRunUnavailableError: () => Effect.succeed(undefined),
					ItemNotOnBoardError: () => Effect.succeed(undefined),
				}),
			);
			if (attempt !== undefined) {
				draft = attempt.queued.runtime;
				facts.push(...attempt.queued.events);
				for (const sourceItemId of attempt.claimed) claimedSourceItemIds.add(sourceItemId);
			}
			dispatched = true;
		}
		draft = {
			...draft,
			items: draft.items.map((candidate) =>
				candidate.id !== item.id
					? candidate
					: {
							...candidate,
							schedule: {
								...state,
								pulseSequence: pulse
									? (state.pulseSequence ?? 0) + 1
									: state.pulseSequence,
								remainingIntervalMs:
									phase !== undefined &&
									phase <= 0 &&
									config.intervalMs !== undefined
										? phase + config.intervalMs
										: phase,
								remainingDurationMs:
									state.remainingDurationMs === undefined
										? undefined
										: Math.max(0, state.remainingDurationMs - elapsed),
							},
						},
			),
		};
		dispatched ||= expired;
	}
	return {
		runtime: draft,
		facts,
		dispatched,
	};
});
