import { Effect } from "effect";
import { match } from "ts-pattern";
import { assertExactInventoryPlacementReadinessFx } from "~/placement/assertExactInventoryPlacementReadinessFx";
import { assertNearestInventoryPlacementReadinessFx } from "~/placement/assertNearestInventoryPlacementReadinessFx";
import type { InventoryItemPlaceReadinessProps } from "~/placement/InventoryItemPlaceReadinessTypes";
import {
	assertInventoryPlacementTargetCellFx,
	readInventoryPlacementDraftFx,
} from "~/placement/readInventoryPlacementDraftFx";

export namespace checkInventoryItemPlaceReadinessFx {
	export type Props = InventoryItemPlaceReadinessProps;
}

export const checkInventoryItemPlaceReadinessFx = Effect.fn("checkInventoryItemPlaceReadinessFx")(
	function* (props: checkInventoryItemPlaceReadinessFx.Props) {
		yield* assertInventoryPlacementTargetCellFx(props);
		const draft = yield* readInventoryPlacementDraftFx(props);
		yield* match(draft.placementMode)
			.with("exact", () =>
				assertExactInventoryPlacementReadinessFx({
					draft,
					props,
				}),
			)
			.with("nearest_by_manhattan", () =>
				assertNearestInventoryPlacementReadinessFx({
					draft,
					props,
				}),
			)
			.exhaustive();

		return {
			itemDefinition: draft.itemDefinition,
			slot: draft.slot,
		};
	},
);
