import { Effect, Option } from "effect";

import type { GameEventSchema } from "~/engine/event/schema/GameEventSchema";
import { readLineInputDeliveryClaimsFx } from "~/engine/delivery/read/readLineInputDeliveryClaimsFx";
import { JobStartSourceEnumSchema } from "~/engine/event/schema/JobStartSourceEnumSchema";
import { requestLineStartRuntimeFx } from "~/engine/job/fx/requestLineStartRuntimeFx";
import type { DeliveryPurposeSchema } from "~/engine/delivery/schema/DeliveryPurposeSchema";
import { reviseRuntimeItemFx } from "~/engine/runtime/fx/reviseRuntimeItemFx";
import { isDeliveryRuntimeItemFx } from "~/engine/runtime/read/isDeliveryRuntimeItemFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace fulfillDeliveryStartPurposesRuntimeFx {
	export interface Props {
		readonly purposes?: ReadonlyArray<DeliveryPurposeSchema.Type>;
		readonly runtime: RuntimeSchema.Type;
	}

	export interface Result {
		readonly events: readonly GameEventSchema.Type[];
		readonly runtime: RuntimeSchema.Type;
	}
}

/**
 * Fulfils durable fill-and-start intents once canonical inputs are physically ready and every
 * still-useful outbound delivery admitted for that exact start request has reached its target.
 *
 * One successful request consumes every equivalent purpose so several source deliveries admitted
 * by one click cannot enqueue duplicate work. Typed readiness/admission failures retain the purpose
 * for a later target-affecting transition; defects remain fail-stop.
 */
export const fulfillDeliveryStartPurposesRuntimeFx = Effect.fn(
	"fulfillDeliveryStartPurposesRuntimeFx",
)(function* ({ purposes = [], runtime }: fulfillDeliveryStartPurposesRuntimeFx.Props) {
	let nextRuntime = runtime;
	const events: GameEventSchema.Type[] = [];
	const attempted = new Set<string>();
	const pendingPurposes = [
		...purposes,
		...(runtime.deliveryStartIntents ?? []).map((intent) => ({
			kind: "fill-and-try-start" as const,
			...intent,
		})),
	];

	for (const runtimeItem of runtime.items) {
		const delivery = yield* isDeliveryRuntimeItemFx(runtimeItem);
		if (Option.isNone(delivery)) continue;
		pendingPurposes.push(delivery.value.location.purpose);
	}
	pendingPurposes.sort((left, right) =>
		left.kind === right.kind ? 0 : left.kind === "fill-and-try-start" ? -1 : 1,
	);

	for (const purpose of pendingPurposes) {
		if (purpose.kind !== "fill-and-try-start") continue;
		const key = `${purpose.ownerItemId}:${purpose.lineId}`;
		if (attempted.has(key)) continue;
		attempted.add(key);

		const pendingDeliveryClaims = yield* readLineInputDeliveryClaimsFx({
			ownerItemId: purpose.ownerItemId,
			lineId: purpose.lineId,
			runtime: nextRuntime,
		});
		if (pendingDeliveryClaims.length > 0) continue;

		const request = yield* Effect.option(
			requestLineStartRuntimeFx({
				ownerItemId: purpose.ownerItemId,
				lineId: purpose.lineId,
				runtime: nextRuntime,
				source: JobStartSourceEnumSchema.enum.Delivery,
			}),
		);
		if (Option.isNone(request)) continue;
		nextRuntime = request.value.runtime;
		events.push(...request.value.events);

		const revisedItems = [];
		for (const candidate of nextRuntime.items) {
			const candidateDelivery = yield* isDeliveryRuntimeItemFx(candidate);
			if (Option.isNone(candidateDelivery)) {
				revisedItems.push(candidate);
				continue;
			}
			const candidatePurpose = candidateDelivery.value.location.purpose;
			if (
				candidatePurpose.kind !== "fill-and-try-start" ||
				candidatePurpose.ownerItemId !== purpose.ownerItemId ||
				candidatePurpose.lineId !== purpose.lineId
			) {
				revisedItems.push(candidate);
				continue;
			}
			revisedItems.push(
				yield* reviseRuntimeItemFx({
					item: {
						...candidateDelivery.value,
						location: {
							...candidateDelivery.value.location,
							purpose: {
								kind: "fill" as const,
							},
						},
					},
				}),
			);
		}
		nextRuntime = {
			...nextRuntime,
			deliveryStartIntents: (nextRuntime.deliveryStartIntents ?? []).filter(
				(intent) =>
					intent.ownerItemId !== purpose.ownerItemId || intent.lineId !== purpose.lineId,
			),
			items: revisedItems,
		} satisfies RuntimeSchema.Type;
	}

	return {
		events,
		runtime: nextRuntime,
	} satisfies fulfillDeliveryStartPurposesRuntimeFx.Result;
});
