import { Effect, Option } from "effect";

import type { IdSchema } from "~/game-config/schema/IdSchema";
import { readDeliveryTravelDurationMsFn } from "~/production-delivery/fn/readDeliveryTravelDurationMsFn";
import { resolveInputMaterialFn } from "~/production-input/fn/resolveInputMaterialFn";
import { isMaterialInputEligibleFn } from "~/production-input/read/fn/isMaterialInputEligibleFn";
import { TypeSchema } from "~/production-input/schema/TypeSchema";
import { isLineInputClosedFn } from "~/production-line/fn/isLineInputClosedFn";
import { readItemLineFn } from "~/production-line/fn/readItemLineFn";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";
import type { GridLocationSchema } from "~/item-location/schema/GridLocationSchema";
import { reviseRuntimeItemFx } from "~/game-runtime/fx/reviseRuntimeItemFx";
import { isDeliveryRuntimeItemFn } from "~/game-runtime/fn/isDeliveryRuntimeItemFn";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { matchesItemSelectorFn } from "~/item-definition/fn/matchesItemSelectorFn";

export namespace reconcileOutboundDeliveriesRuntimeFx {
	export interface Props {
		readonly returnFromByOwnerItemId?: ReadonlyMap<IdSchema.Type, GridLocationSchema.Type>;
		readonly runtime: RuntimeSchema.Type;
	}
}

/**
 * Reconciles every outbound soft claim against current physical input truth.
 *
 * Earlier runtime order wins. Claims shrink but never grow; a delivery with no remaining useful
 * allocation becomes a canonical return using the target owner's current board position as the
 * persisted return origin.
 */
export const reconcileOutboundDeliveriesRuntimeFx = Effect.fn(
	"reconcileOutboundDeliveriesRuntimeFx",
)(function* ({ returnFromByOwnerItemId, runtime }: reconcileOutboundDeliveriesRuntimeFx.Props) {
	const remainingTargetBySlot = new Map<string, number>();
	let nextRuntime = runtime;

	for (const item of runtime.items) {
		const delivery = isDeliveryRuntimeItemFn(item);
		if (Option.isNone(delivery)) continue;
		const current = delivery.value;
		if (current.location.phase !== "outbound") continue;

		const { target } = current.location;
		const owner = nextRuntime.items.find((candidate) => candidate.id === target.ownerItemId);
		const line =
			owner === undefined
				? undefined
				: readItemLineFn({
						item: owner.item,
						lineId: target.lineId,
					});
		const retained: {
			readonly inputIndex: number;
			readonly quantity: number;
		}[] = [];
		let unallocatedQuantity = current.quantity;

		if (owner?.location.scope === LocationScopeEnumSchema.enum.Board && line !== undefined) {
			for (const allocation of target.input) {
				const input = line.input[allocation.inputIndex];
				if (
					input === undefined ||
					input.type !== TypeSchema.enum.Materials ||
					!isMaterialInputEligibleFn(current.item) ||
					!matchesItemSelectorFn({
						item: current.item,
						selector: input.selector,
					}) ||
					isLineInputClosedFn({
						input,
						ownerItemId: owner.id,
						lineId: line.id,
						runtime: nextRuntime,
					})
				) {
					continue;
				}

				const key = `${owner.id}:${line.id}:${allocation.inputIndex}`;
				let remainingTarget = remainingTargetBySlot.get(key);
				if (remainingTarget === undefined) {
					const storedQuantity = nextRuntime.items.reduce((total, candidate) => {
						return candidate.location.scope === LocationScopeEnumSchema.enum.Input &&
							candidate.location.ownerItemId === owner.id &&
							candidate.location.lineId === line.id &&
							candidate.location.inputIndex === allocation.inputIndex
							? total + candidate.quantity
							: total;
					}, 0);
					const resolution = resolveInputMaterialFn({
						input,
						storedQuantity,
					});
					remainingTarget = Math.max(0, resolution.required.max - storedQuantity);
				}
				const quantity = Math.min(
					allocation.quantity,
					remainingTarget,
					unallocatedQuantity,
				);
				remainingTargetBySlot.set(key, remainingTarget - quantity);
				if (quantity === 0) continue;
				retained.push({
					inputIndex: allocation.inputIndex,
					quantity,
				});
				unallocatedQuantity -= quantity;
			}
		}

		const unchanged =
			retained.length === target.input.length &&
			retained.every((allocation, index) => {
				const previous = target.input[index];
				return (
					previous?.inputIndex === allocation.inputIndex &&
					previous.quantity === allocation.quantity
				);
			});
		if (unchanged) continue;

		const returnFrom =
			owner?.location.scope === LocationScopeEnumSchema.enum.Board
				? owner.location
				: (returnFromByOwnerItemId?.get(target.ownerItemId) ?? current.location.origin);
		const revised = yield* reviseRuntimeItemFx({
			item: {
				...current,
				location:
					retained.length === 0
						? {
								scope: LocationScopeEnumSchema.enum.Delivery,
								phase: "returning" as const,
								generation: current.location.generation + 1,
								origin: current.location.origin,
								remainingDurationMs: readDeliveryTravelDurationMsFn({
									from: returnFrom,
									to: current.location.origin,
								}),
								returnFrom,
							}
						: {
								...current.location,
								generation: current.location.generation + 1,
								target: {
									...target,
									input: retained,
								},
							},
			},
		});
		nextRuntime = {
			...nextRuntime,
			items: nextRuntime.items.map((candidate) =>
				candidate.id === revised.id ? revised : candidate,
			),
		} satisfies RuntimeSchema.Type;
	}

	return nextRuntime;
});
