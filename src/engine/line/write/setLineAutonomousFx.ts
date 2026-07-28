import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { isolateStatefulOwnerTransitionFx } from "~/engine/item/fx/isolateStatefulOwnerTransitionFx";
import { LineAutonomousUnavailableError } from "~/engine/line/error/LineAutonomousUnavailableError";
import { readBoardItemLineFx } from "~/engine/line/fx/readBoardItemLineFx";
import { reviseRuntimeItemFx } from "~/engine/runtime/fx/reviseRuntimeItemFx";
import { modifyRuntimeFx } from "~/engine/runtime/internal/modifyRuntimeFx";
import { isDeliveryRuntimeItemFx } from "~/engine/runtime/read/isDeliveryRuntimeItemFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { Option } from "effect";

export namespace setLineAutonomousFx {
	export interface Props {
		readonly enabled: boolean;
		readonly lineId: IdSchema.Type;
		readonly ownerItemId: IdSchema.Type;
	}
}

/** Enables or disables one author-opted-in autonomous line for an exact live board owner. */
export const setLineAutonomousFx = Effect.fn("setLineAutonomousFx")(function* ({
	enabled,
	lineId,
	ownerItemId,
}: setLineAutonomousFx.Props) {
	return yield* modifyRuntimeFx((runtime) =>
		Effect.gen(function* () {
			const { line } = yield* readBoardItemLineFx({
				ownerItemId,
				lineId,
				runtime,
			});
			if (!line.autonomous) {
				return yield* Effect.fail(
					new LineAutonomousUnavailableError({
						ownerItemId,
						lineId,
					}),
				);
			}
			const current = runtime.autonomousLines ?? [];
			const selected = current.some(
				(candidate) => candidate.ownerItemId === ownerItemId && candidate.lineId === lineId,
			);
			if (selected === enabled) {
				return [
					{
						enabled,
						lineId,
						ownerItemId,
					},
					runtime,
				] as const;
			}
			const autonomousLines = enabled
				? [
						...current,
						{
							ownerItemId,
							lineId,
						},
					]
				: current.filter(
						(candidate) =>
							candidate.ownerItemId !== ownerItemId || candidate.lineId !== lineId,
					);
			const items = [];
			for (const item of runtime.items) {
				const delivery = yield* isDeliveryRuntimeItemFx(item);
				if (Option.isNone(delivery)) {
					items.push(item);
					continue;
				}
				const purpose = delivery.value.location.purpose;
				const purposeStillEnabled =
					purpose.kind !== "fill-and-try-start" ||
					purpose.source !== "autonomous" ||
					autonomousLines.some(
						(candidate) =>
							candidate.ownerItemId === purpose.ownerItemId &&
							candidate.lineId === purpose.lineId,
					);
				if (purposeStillEnabled) {
					items.push(item);
					continue;
				}
				items.push(
					yield* reviseRuntimeItemFx({
						item: {
							...delivery.value,
							location: {
								...delivery.value.location,
								purpose: {
									kind: "fill" as const,
								},
							},
						},
					}),
				);
			}
			const selectedRuntime = {
				...runtime,
				autonomousLines,
				deliveryStartIntents: (runtime.deliveryStartIntents ?? []).filter(
					(intent) =>
						intent.source !== "autonomous" ||
						autonomousLines.some(
							(candidate) =>
								candidate.ownerItemId === intent.ownerItemId &&
								candidate.lineId === intent.lineId,
						),
				),
				items,
			} satisfies RuntimeSchema.Type;
			const isolation = yield* isolateStatefulOwnerTransitionFx({
				ownerItemId,
				runtime: selectedRuntime,
			});
			return [
				{
					enabled,
					lineId,
					ownerItemId,
				},
				isolation.runtime,
				isolation.events,
			] as const;
		}),
	);
});
