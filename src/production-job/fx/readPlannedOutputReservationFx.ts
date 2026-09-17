import { Effect } from "effect";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import { ModeSchema } from "~/production-input/schema/ModeSchema";
import { TypeSchema } from "~/production-input/schema/TypeSchema";
import { readItemRemainingUnitsFn } from "~/production-action/fn/readItemRemainingUnitsFn";
import type { LineSchema } from "~/production-line/schema/LineSchema";
import type { LineRun } from "~/production-line/type/LineRun";
import { readOutputMaximumQuantitiesFn } from "~/production-output/fn/readOutputMaximumQuantitiesFn";
import { readRuntimeItemByIdFx } from "~/game-runtime/fx/readRuntimeItemByIdFx";
import { readRuntimeItemOwnedStateFn } from "~/game-runtime/fn/readRuntimeItemOwnedStateFn";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { applyFinalUnitReservationFx } from "./applyFinalUnitReservationFx";
import { adjustOutputReservationFx } from "./adjustOutputReservationFx";
import { clampOutputReservationFx } from "./clampOutputReservationFx";

export namespace readPlannedOutputReservationFx {
	export interface Props {
		readonly line: LineSchema.Type;
		readonly plan: LineRun.Plan;
		readonly runtime: RuntimeSchema.Type;
	}

	export interface Result {
		readonly quantities: ReadonlyMap<IdSchema.Type, number>;
		readonly discardedItemIds: ReadonlySet<IdSchema.Type>;
	}
}

/**
 * Computes one exact candidate plan's future quantity delta without applying
 * input moves, unit spends, lifecycle output, placement, or identity changes.
 */
export const readPlannedOutputReservationFx = Effect.fn("readPlannedOutputReservationFx")(
	function* ({ line, plan, runtime }: readPlannedOutputReservationFx.Props) {
		const quantities =
			line.output === undefined
				? new Map<IdSchema.Type, number>()
				: new Map(
						readOutputMaximumQuantitiesFn({
							output: line.output,
						}),
					);

		const discardedItemIds = new Set<IdSchema.Type>();
		for (const input of plan.input) {
			if (
				input.type !== TypeSchema.enum.Materials ||
				input.mode !== ModeSchema.enum.Consume
			) {
				continue;
			}
			for (const allocation of input.item) {
				const item = yield* readRuntimeItemByIdFx({
					itemId: allocation.itemId,
					runtime,
				});
				yield* adjustOutputReservationFx(quantities, item.item.id, -allocation.quantity);
				if (allocation.quantity !== item.quantity) continue;
				const owned = readRuntimeItemOwnedStateFn({
					ownerItemId: item.id,
					runtime,
				});
				if (owned.jobs.length > 0 || owned.jobItems.length > 0 || owned.queue.length > 0)
					continue;
				// Descendants disappear at start, so admission removes them from live counts.
				// They may free capacity for any job, unlike this root's completion credit.
				for (const descendant of owned.inputItems) {
					discardedItemIds.add(descendant.id);
				}
			}
		}

		const costs = new Map<IdSchema.Type, number>();
		for (const input of plan.input) {
			if (input.units === undefined) continue;
			costs.set(input.units.itemId, (costs.get(input.units.itemId) ?? 0) + input.units.cost);
		}
		for (const [payerId, cost] of costs) {
			const payer = yield* readRuntimeItemByIdFx({
				itemId: payerId,
				runtime,
			});
			const remainingUnits = readItemRemainingUnitsFn(payer);
			if (remainingUnits !== cost) continue;
			// An external active payer settles with its own job. Its future removal
			// cannot offset this candidate's output; admission projects that job separately.
			if (
				payerId !== plan.ownerItemId &&
				runtime.jobs.some((job) => job.ownerItemId === payerId)
			)
				continue;
			yield* applyFinalUnitReservationFx({
				payer: payer.item,
				quantities,
			});
		}

		return {
			quantities: yield* clampOutputReservationFx(quantities),
			discardedItemIds,
		} satisfies readPlannedOutputReservationFx.Result;
	},
);
