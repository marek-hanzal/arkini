import { Effect, Option } from "effect";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import { readDeliveryTravelDurationMsFn } from "~/production-delivery/fn/readDeliveryTravelDurationMsFn";
import { resolveInputMaterialFn } from "~/production-input/fn/resolveInputMaterialFn";
import { TypeSchema } from "~/production-input/schema/TypeSchema";
import { isLineInputClosedFn } from "~/production-line/fn/isLineInputClosedFn";
import { readItemLineFn } from "~/production-line/fn/readItemLineFn";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";
import type { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";
import { reviseRuntimeItemFx } from "~/game-runtime/fx/reviseRuntimeItemFx";
import { narrowDeliveryRuntimeItemFn } from "~/game-runtime/fn/narrowDeliveryRuntimeItemFn";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { matchesItemSelectorFn } from "~/item-definition/fn/matchesItemSelectorFn";

export namespace reconcileOutboundDeliveriesRuntimeFx {
	export interface Props {
		readonly returnLineIdsByOwnerItemId?: ReadonlyMap<
			IdSchema.Type,
			ReadonlySet<IdSchema.Type>
		>;
		readonly returnFromByOwnerItemId?: ReadonlyMap<IdSchema.Type, BoardLocationSchema.Type>;
		readonly runtime: RuntimeSchema.Type;
	}
}

/**
 * Reconciles every outbound soft claim against current physical input truth.
 *
 * Earlier runtime order wins; callers may invalidate exact owner-line
 * targets when their pending intent is removed. A delivery without available capacity
 * becomes a canonical return using the target owner's current board position as the persisted
 * return origin.
 */
export const reconcileOutboundDeliveriesRuntimeFx = Effect.fn(
	"reconcileOutboundDeliveriesRuntimeFx",
)(function* ({
	returnFromByOwnerItemId,
	returnLineIdsByOwnerItemId,
	runtime,
}: reconcileOutboundDeliveriesRuntimeFx.Props) {
	const remainingTargetBySlot = new Map<string, number>();
	let nextRuntime = runtime;

	for (const item of runtime.items) {
		const delivery = narrowDeliveryRuntimeItemFn(item);
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
		let retained = false;
		const returnRequested =
			returnLineIdsByOwnerItemId?.get(target.ownerItemId)?.has(target.lineId) === true;

		if (
			!returnRequested &&
			owner?.location.scope === LocationScopeEnumSchema.enum.Board &&
			line !== undefined
		) {
			do {
				const input = line.input[target.inputIndex];
				if (
					input === undefined ||
					input.type !== TypeSchema.enum.Materials ||
					!matchesItemSelectorFn({
						item: current.item,
						selector: input.query.selector,
					}) ||
					isLineInputClosedFn({
						ownerItemId: owner.id,
						lineId: line.id,
						runtime: nextRuntime,
					})
				) {
					continue;
				}

				const key = JSON.stringify([
					owner.id,
					line.id,
					target.inputIndex,
				]);
				let remainingTarget = remainingTargetBySlot.get(key);
				if (remainingTarget === undefined) {
					const storedQuantity = nextRuntime.items.reduce((total, candidate) => {
						return candidate.location.scope === LocationScopeEnumSchema.enum.Input &&
							candidate.location.ownerItemId === owner.id &&
							candidate.location.lineId === line.id &&
							candidate.location.inputIndex === target.inputIndex
							? total + 1
							: total;
					}, 0);
					const resolution = resolveInputMaterialFn({
						input,
						storedQuantity,
					});
					remainingTarget = Math.max(0, resolution.required.max - storedQuantity);
				}
				if (remainingTarget > 0) {
					remainingTargetBySlot.set(key, remainingTarget - 1);
					retained = true;
				}
			} while (false);
		}
		if (retained) continue;

		const returnFrom =
			owner?.location.scope === LocationScopeEnumSchema.enum.Board
				? owner.location
				: (returnFromByOwnerItemId?.get(target.ownerItemId) ?? current.location.origin);
		const revised = yield* reviseRuntimeItemFx({
			item: {
				...current,
				location: {
					scope: LocationScopeEnumSchema.enum.Delivery,
					phase: "returning" as const,
					generation: current.location.generation + 1,
					origin: current.location.origin,
					remainingDurationMs: readDeliveryTravelDurationMsFn({
						from: returnFrom,
						to: current.location.origin,
					}),
					returnFrom,
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
