import { Effect } from "effect";

import type { PlannerSearchChargeQuantity } from "~/editor/planner/PlannerSearch";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { GameEventEnumSchema } from "~/engine/event/schema/GameEventEnumSchema";
import type { GameEventSchema } from "~/engine/event/schema/GameEventSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace readPlannerActionChargeFlowFx {
	export interface Props {
		readonly before: RuntimeSchema.Type;
		readonly events: ReadonlyArray<GameEventSchema.Type>;
	}
}

const compareIds = (left: string, right: string) => left.localeCompare(right);

/** Reads canonical charge quantities committed by one completed planner action. */
export const readPlannerActionChargeFlowFx = Effect.fn("readPlannerActionChargeFlowFx")(
	({ before, events }: readPlannerActionChargeFlowFx.Props) =>
		Effect.sync(() => {
			const spentByItemId = new Map<IdSchema.Type, number>();
			const addSpent = (itemId: IdSchema.Type, charges: number) => {
				if (charges <= 0) return;
				spentByItemId.set(itemId, (spentByItemId.get(itemId) ?? 0) + charges);
			};

			for (const event of events) {
				if (event.type === GameEventEnumSchema.enum.ItemChargeSpent) {
					addSpent(event.canonicalItemId, event.previousCharges - event.resultingCharges);
					continue;
				}
				if (event.type !== GameEventEnumSchema.enum.ItemDepleted) continue;

				const item = before.items.find((candidate) => candidate.id === event.itemId);
				const charges = item?.remainingCharges ?? item?.item.charges?.amount;
				if (charges === undefined)
					throw new RangeError(
						`Planner action depleted ${event.itemId} without a charged before-state identity.`,
					);
				addSpent(event.canonicalItemId, charges);
			}

			return [
				...spentByItemId,
			]
				.map(
					([itemId, charges]): PlannerSearchChargeQuantity => ({
						charges,
						itemId,
					}),
				)
				.sort((left, right) => compareIds(left.itemId, right.itemId));
		}),
);
