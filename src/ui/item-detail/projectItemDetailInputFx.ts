import { Effect } from "effect";
import { match } from "ts-pattern";

import type { GameEngine } from "~/renderer/game/GameEngine";
import type { ItemDetailLines } from "~/ui/item-detail/ItemDetailLines";
import { projectItemDetailReferenceFx } from "~/item-detail-frame/projectItemDetailReferenceFx";
import { projectItemDetailSelectorFn } from "~/ui/item-detail/fn/projectItemDetailSelectorFn";
import type { readItemDetailLinesFx } from "~/engine/item-detail/read/readItemDetailLinesFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace projectItemDetailInputFx {
	export interface Props {
		readonly game: GameEngine;
		readonly input: readItemDetailLinesFx.Input;
		readonly runtime: RuntimeSchema.Type;
	}

	export type Result = ItemDetailLines.Input;
}

/** Projects one engine-owned line input into its renderer label and optional detail target. */
export const projectItemDetailInputFx = Effect.fn("projectItemDetailInputFx")(function* ({
	game,
	input,
	runtime,
}: projectItemDetailInputFx.Props) {
	return yield* match(input)
		.with(
			{
				kind: "materials",
			},
			(materials) =>
				Effect.gen(function* () {
					const selector = projectItemDetailSelectorFn({
						game,
						selector: materials.selector,
					});
					const detail = yield* projectItemDetailReferenceFx({
						game,
						itemId: materials.selector.itemId,
						runtime,
					});
					return {
						...materials,
						selector,
						...(detail === undefined
							? {}
							: {
									detail,
								}),
					} satisfies projectItemDetailInputFx.Result;
				}),
		)
		.with(
			{
				kind: "deposit",
			},
			(deposit) =>
				Effect.gen(function* () {
					const selector = projectItemDetailSelectorFn({
						game,
						selector: deposit.selector,
					});
					const exactTargetId =
						deposit.targetItemIds.length === 1 ? deposit.targetItemIds[0] : undefined;
					const detail = yield* projectItemDetailReferenceFx({
						game,
						itemId: deposit.selector.itemId,
						preferredRuntimeItemIds:
							exactTargetId === undefined
								? []
								: [
										exactTargetId,
									],
						runtime,
					});
					return {
						kind: deposit.kind,
						selector,
						distance: deposit.distance,
						requiredCharges: deposit.requiredCharges,
						availableCharges: deposit.availableCharges,
						availableChargesLabel:
							deposit.targetItemIds.length === 0
								? "None"
								: String(deposit.availableCharges),
						targetTitles: deposit.targetItemIds.map(
							(itemId) =>
								runtime.items.find((item) => item.id === itemId)?.item.title ??
								itemId,
						),
						ready: deposit.ready,
						...(deposit.charges === undefined
							? {}
							: {
									charges: deposit.charges,
								}),
						...(detail === undefined
							? {}
							: {
									detail,
								}),
					} satisfies projectItemDetailInputFx.Result;
				}),
		)
		.with(
			{
				kind: "simple",
			},
			(simple) => Effect.succeed(simple),
		)
		.exhaustive();
});
