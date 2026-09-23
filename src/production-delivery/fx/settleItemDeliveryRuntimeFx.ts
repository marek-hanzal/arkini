import { Effect, Option } from "effect";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { NonNegativeIntegerSchema } from "~/game-value/schema/NonNegativeIntegerSchema";
import { readDeliveryTravelDurationMsFn } from "~/production-delivery/fn/readDeliveryTravelDurationMsFn";
import { reconcileOutboundDeliveriesRuntimeFx } from "~/production-delivery/fx/reconcileOutboundDeliveriesRuntimeFx";
import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";
import { applyInputMaterialStorePlanFx } from "~/production-input/fx/applyInputMaterialStorePlanFx";
import { planInputMaterialStoreFn } from "~/production-input/fn/planInputMaterialStoreFn";
import { filterInputSlotItemsFn } from "~/production-input/fn/filterInputSlotItemsFn";
import { TypeSchema } from "~/production-input/schema/TypeSchema";
import { isLineInputClosedFn } from "~/production-line/fn/isLineInputClosedFn";
import { readItemLineFn } from "~/production-line/fn/readItemLineFn";
import { readGridLocationClaimsFn } from "~/item-location/fn/readGridLocationClaimsFn";
import { readGridLocationKeyFn } from "~/item-location/fn/readGridLocationKeyFn";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";
import { reviseRuntimeItemFx } from "~/game-runtime/fx/reviseRuntimeItemFx";
import { narrowDeliveryRuntimeItemFn } from "~/game-runtime/fn/narrowDeliveryRuntimeItemFn";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

export namespace settleItemDeliveryRuntimeFx {
	export interface Props {
		readonly itemId: IdSchema.Type;
		readonly generation: NonNegativeIntegerSchema.Type;
		readonly runtime: RuntimeSchema.Type;
	}

	export interface SettlementResult {
		readonly status: "ignored" | "returned" | "stored";
	}

	export type Result =
		| readonly [
				SettlementResult,
				RuntimeSchema.Type,
		  ]
		| readonly [
				SettlementResult,
				RuntimeSchema.Type,
				readonly GameEventSchema.Type[],
		  ];
}

/** Applies one guarded delivery settlement to an immutable runtime draft. */
export const settleItemDeliveryRuntimeFx = Effect.fn("settleItemDeliveryRuntimeFx")(function* ({
	itemId,
	generation,
	runtime,
}: settleItemDeliveryRuntimeFx.Props) {
	return yield* Effect.gen(function* () {
		const runtimeItem = runtime.items.find((candidate) => candidate.id === itemId);
		if (runtimeItem === undefined) {
			const result: settleItemDeliveryRuntimeFx.SettlementResult = {
				status: "ignored",
			};
			return [
				result,
				runtime,
			] as const;
		}
		const delivery = narrowDeliveryRuntimeItemFn(runtimeItem);
		if (Option.isNone(delivery) || delivery.value.location.generation !== generation) {
			const result: settleItemDeliveryRuntimeFx.SettlementResult = {
				status: "ignored",
			};
			return [
				result,
				runtime,
			] as const;
		}
		const current = delivery.value;
		if (current.location.phase === "returning") {
			const claims = readGridLocationClaimsFn({
				runtime,
			});
			const originKey = readGridLocationKeyFn(current.location.origin);
			let conflictingClaim: (typeof claims)[number] | undefined;
			for (const claim of claims) {
				if (
					claim.itemId !== current.id &&
					readGridLocationKeyFn(claim.location) === originKey
				) {
					conflictingClaim = claim;
					break;
				}
			}
			if (conflictingClaim !== undefined) {
				return yield* Effect.die(
					new Error(
						`Delivery ${current.id} lost its canonical origin lease to ${conflictingClaim.itemId}.`,
					),
				);
			}
			const returned = yield* reviseRuntimeItemFx({
				item: {
					...current,
					location: current.location.origin,
				},
			});
			const returnedRuntime = {
				...runtime,
				items: runtime.items.map((candidate) =>
					candidate.id === returned.id ? returned : candidate,
				),
			} satisfies RuntimeSchema.Type;
			const result: settleItemDeliveryRuntimeFx.SettlementResult = {
				status: "returned",
			};
			return [
				result,
				returnedRuntime,
			] as const;
		}

		const target = current.location.target;
		const owner = runtime.items.find((candidate) => candidate.id === target.ownerItemId);
		const line =
			owner === undefined
				? undefined
				: readItemLineFn({
						item: owner.item,
						lineUid: target.lineUid,
					});
		let inputRuntime = runtime;
		let accepted = false;
		const input = line?.input[target.inputIndex];
		if (
			owner?.location.scope === LocationScopeEnumSchema.enum.Board &&
			line !== undefined &&
			input?.type === TypeSchema.enum.Materials &&
			!isLineInputClosedFn({
				ownerItemId: owner.id,
				lineUid: line.uid,
				runtime,
			})
		) {
			const storedItems = filterInputSlotItemsFn({
				inputIndex: target.inputIndex,
				items: runtime.items,
				lineUid: line.uid,
				ownerItemId: owner.id,
			});
			const plan = planInputMaterialStoreFn({
				input,
				item: current,
				storedQuantity: storedItems.length,
			});
			if (plan !== undefined) {
				const [, nextRuntime] = yield* applyInputMaterialStorePlanFx({
					location: {
						scope: LocationScopeEnumSchema.enum.Input,
						ownerItemId: owner.id,
						lineUid: line.uid,
						inputIndex: target.inputIndex,
					},
					runtime,
					source: current,
				});
				inputRuntime = nextRuntime;
				accepted = true;
			}
		}

		// Contact either commits the whole identity or sends it home before claim reconciliation.
		if (!accepted) {
			const returnFrom =
				owner?.location.scope === LocationScopeEnumSchema.enum.Board
					? owner.location
					: current.location.origin;
			const returningSource = yield* reviseRuntimeItemFx({
				item: {
					...current,
					location: {
						scope: LocationScopeEnumSchema.enum.Delivery,
						phase: "returning",
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
			inputRuntime = {
				...inputRuntime,
				items: inputRuntime.items.map((candidate) =>
					candidate.id === current.id ? returningSource : candidate,
				),
			};
		}

		const reconciledRuntime = yield* reconcileOutboundDeliveriesRuntimeFx({
			runtime: inputRuntime,
		});
		const result: settleItemDeliveryRuntimeFx.SettlementResult = {
			status: accepted ? "stored" : "returned",
		};
		return [
			result,
			reconciledRuntime,
		] as const;
	});
});

/** Commits one guarded delivery settlement against the serialized runtime store. */
