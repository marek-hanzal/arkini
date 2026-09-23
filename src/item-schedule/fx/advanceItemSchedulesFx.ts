import { Effect } from "effect";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { EngineFact } from "~/game-event/type/EngineFact";
import { readItemScheduleFn } from "~/item-schedule/fn/readItemScheduleFn";
import { resolveItemScheduleEnabledFx } from "~/item-schedule/fx/resolveItemScheduleEnabledFx";
import { selectClockLineFx } from "~/item-schedule/fx/selectClockLineFx";
import { enqueueLineRuntimeFx } from "~/production-job/fx/enqueueLineRuntimeFx";
import { SimulationStepMs } from "~/simulation-time/constant/SimulationStepMs";

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
			phase !== undefined && phase <= 0 && !(expired && config.expiryMode === "kill-switch");
		if (pulse) {
			// A rejected choice consumes this pulse; never retry another line or mutate accepted work.
			const attempt = yield* Effect.gen(function* () {
				const line = yield* selectClockLineFx({
					item,
					runtime: draft,
				});
				if (line === undefined) return undefined;
				return yield* enqueueLineRuntimeFx({
					ownerItemId: item.id,
					lineId: line.id,
					runtime: draft,
				});
			}).pipe(
				Effect.catchTags({
					JobQueueFullError: () => Effect.succeed(undefined),
					LineRunUnavailableError: () => Effect.succeed(undefined),
					ItemNotOnBoardError: () => Effect.succeed(undefined),
				}),
			);
			if (attempt !== undefined) {
				draft = attempt.runtime;
				facts.push(...attempt.events);
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
