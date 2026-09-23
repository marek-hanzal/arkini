import { Effect } from "effect";
import { readItemRemainingUnitsFn } from "~/production-action/fn/readItemRemainingUnitsFn";
import { resolveLineRunFx } from "~/production-line/fx/resolveLineRunFx";
import { canControlItemProductionFn } from "~/production-line/fn/canControlItemProductionFn";
import { isItemProductionAdmissionOpenFn } from "~/production-line/fn/isItemProductionAdmissionOpenFn";
import { isLineInputClosedFn } from "~/production-line/fn/isLineInputClosedFn";
import { resolveItemScheduleEnabledFx } from "~/item-schedule/fx/resolveItemScheduleEnabledFx";

import { readLineInputAutofillSourcesFn } from "~/production-input/fn/readLineInputAutofillSourcesFn";
import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { readLineInputDeliveryClaimsFn } from "~/production-delivery/fn/readLineInputDeliveryClaimsFn";
import { planLineInputAutofillFx } from "~/production-input/fx/planLineInputAutofillFx";
import type { MaterialSchema } from "~/production-input/schema/MaterialSchema";
import type { LineSchema } from "~/production-line/schema/LineSchema";

export namespace readItemLineInputsFx {
	export interface Props {
		readonly ownerItemId?: IdSchema.Type;
		readonly line: LineSchema.Type;
		readonly runtime: RuntimeSchema.Type;
		readonly work?: {
			readonly kind: "active" | "queued";
			readonly id: IdSchema.Type;
		};
	}

	export interface Input {
		readonly type: "materials" | "units";
		readonly inputIndex: number;
		readonly itemUid: IdSchema.Type;
		readonly quantity: MaterialSchema.Type["quantity"];
		readonly filled: number;
		readonly available: boolean;
		/** For materials, obtainable stock plus this slot's incoming deliveries, excluding already filled material. For units, the selected target's remaining units. */
		readonly availableQuantity: number;
		readonly committed: boolean;
		readonly canWithdraw: boolean;
		readonly canAutofill: boolean;
		/** Earliest running expiry, or the next cycle for Clock without a finite lifetime. */
		readonly clock?: {
			readonly kind: "expiry" | "cycle";
			readonly remainingMs: number;
			readonly durationMs: number;
		};
	}
}

/** Projects material ownership and in-place unit readiness without duplicating production admission. */
export const readItemLineInputsFx = Effect.fn("readItemLineInputsFx")(function* ({
	ownerItemId,
	line,
	runtime,
	work,
}: readItemLineInputsFx.Props) {
	const owner = runtime.items.find((item) => item.id === ownerItemId);
	const liveLine = owner?.item.lines.find((candidate) => candidate.id === line.id);
	const plan =
		work === undefined && owner?.location.scope === "board" && liveLine !== undefined
			? yield* planLineInputAutofillFx({
					ownerItemId: owner.id,
					lineId: line.id,
					runtime,
				})
			: undefined;

	const job = runtime.jobs.find(
		(candidate) =>
			candidate.ownerItemId === ownerItemId &&
			candidate.lineId === line.id &&
			(work === undefined || (work.kind === "active" && candidate.id === work.id)),
	);
	// Line buffers serve the earliest pending request, not every duplicate or its active predecessor.
	const ownsBuffer =
		work === undefined ||
		(work.kind === "queued" &&
			runtime.jobQueue.find(
				(request) => request.ownerItemId === ownerItemId && request.lineId === line.id,
			)?.id === work.id);
	// Resolve the whole line so several inputs cannot claim the same remaining units.
	const unitReadiness =
		owner?.location.scope === "board" && liveLine?.input.some((input) => input.type === "units")
			? yield* resolveLineRunFx({
					ownerItemId: owner.id,
					lineId: line.id,
					runtime,
				})
			: undefined;
	const inputs: readItemLineInputsFx.Input[] = [];
	for (const [inputIndex, input] of (liveLine ?? line).input.entries()) {
		if (input.type === "units") {
			// Active jobs have already paid their unit costs, even if that exhausted the payer.
			const committed = job !== undefined;
			const resolution = unitReadiness?.input[inputIndex]?.resolution;
			const available = resolution?.ready ?? false;
			const target =
				resolution?.type === "units"
					? runtime.items.find((item) => item.id === resolution.targetItemId)
					: undefined;
			inputs.push({
				type: "units",
				inputIndex,
				itemUid: input.query.selector.itemUid,
				quantity: {
					min: 1,
					max: 1,
				},
				filled: available || committed ? 1 : 0,
				available,
				availableQuantity:
					target === undefined ? 0 : (readItemRemainingUnitsFn(target) ?? 0),
				committed,
				canWithdraw: false,
				canAutofill: false,
			});
			continue;
		}
		if (input.type !== "materials") continue;
		let filled = 0;
		let committed = false;
		let buffered = 0;
		let clock: readItemLineInputsFx.Input["clock"];
		for (const item of runtime.items) {
			const location = item.location;
			if (
				ownsBuffer &&
				location.scope === "input" &&
				location.ownerItemId === ownerItemId &&
				location.lineId === line.id &&
				location.inputIndex === inputIndex
			) {
				filled += 1;
				buffered += 1;
			} else if (
				(location.scope === "job" || location.scope === "reserved") &&
				job !== undefined &&
				location.jobId === job.id &&
				location.inputIndex === inputIndex
			) {
				filled += 1;
				committed = true;
			} else continue;
			const remaining =
				item.schedule?.remainingDurationMs ?? item.schedule?.remainingIntervalMs;
			const kind = item.schedule?.remainingDurationMs === undefined ? "cycle" : "expiry";
			const duration =
				kind === "expiry" ? item.item.clock?.durationMs : item.item.clock?.intervalMs;
			if (
				remaining !== undefined &&
				duration !== undefined &&
				(yield* resolveItemScheduleEnabledFx({
					item,
					runtime,
				}))
			) {
				if (
					clock === undefined ||
					(kind === "expiry" && clock.kind === "cycle") ||
					(kind === clock.kind && remaining < clock.remainingMs)
				) {
					clock = {
						kind,
						remainingMs: remaining,
						durationMs: duration,
					};
				}
			}
		}
		const incoming =
			ownerItemId === undefined || !ownsBuffer
				? []
				: readLineInputDeliveryClaimsFn({
						ownerItemId,
						lineId: line.id,
						inputIndex,
						runtime,
					});
		const sources =
			owner?.location.scope === "board"
				? readLineInputAutofillSourcesFn({
						owner: {
							...owner,
							location: owner.location,
						},
						runtime,
						query: input.query,
					})
				: [];
		const availableQuantity = sources.length + incoming.length;

		inputs.push({
			type: "materials",
			inputIndex,
			itemUid: input.query.selector.itemUid,
			quantity: input.quantity,
			filled,
			committed,
			canAutofill:
				ownsBuffer &&
				filled === 0 &&
				owner?.location.scope === "board" &&
				liveLine !== undefined &&
				canControlItemProductionFn(owner.item) &&
				isItemProductionAdmissionOpenFn(owner) &&
				!isLineInputClosedFn({
					ownerItemId: owner.id,
					lineId: line.id,
					runtime,
				}) &&
				incoming.length < input.quantity.max &&
				sources.length > 0,
			canWithdraw:
				buffered > 0 &&
				!committed &&
				owner?.location.scope === "board" &&
				canControlItemProductionFn(owner.item),
			clock,
			availableQuantity,
			available:
				work === undefined
					? incoming.length > 0 ||
						(plan?.entry.some((entry) => entry.inputIndex === inputIndex) ?? false)
					: availableQuantity > 0,
		});
	}
	return inputs;
});
