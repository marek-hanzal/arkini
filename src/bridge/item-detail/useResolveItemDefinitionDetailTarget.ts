import { useCallback } from "react";

import { useGameEngine } from "~/bridge/game/useGameEngine";
import type { ItemDetailTab } from "~/bridge/item-detail/ItemDetailTab";
import { readItemDetailSourcesFx } from "~/engine/item-detail/read/readItemDetailSourcesFx";
import { readItemDetailTabsFx } from "~/engine/item-detail/read/readItemDetailTabsFx";
import { ItemDetailTabEnumSchema } from "~/engine/item-detail/schema/ItemDetailTabEnumSchema";

export namespace useResolveItemDefinitionDetailTarget {
	export interface Props {
		readonly itemId: string;
		readonly requestedTab?: Extract<ItemDetailTab, "info" | "sources">;
	}

	export type Result =
		| {
				readonly kind: "available";
				readonly itemId: string;
				readonly tab: Extract<ItemDetailTab, "info" | "sources">;
		  }
		| {
				readonly kind: "unavailable";
		  };
}

const unavailable = {
	kind: "unavailable",
} as const satisfies useResolveItemDefinitionDetailTarget.Result;

/** Resolves one configured Item Detail target without manufacturing a runtime identity. */
export const useResolveItemDefinitionDetailTarget = () => {
	const game = useGameEngine();
	return useCallback(
		({
			itemId,
			requestedTab,
		}: useResolveItemDefinitionDetailTarget.Props): useResolveItemDefinitionDetailTarget.Result => {
			const runtime = game.getSnapshot();
			const sources = game.readOrThrow(
				readItemDetailSourcesFx({
					target: {
						kind: "definition",
						itemId,
					},
					runtime,
				}),
			);
			if (sources.kind === "unavailable") return unavailable;
			const tabs = game.readOrThrow(
				readItemDetailTabsFx({
					target: {
						kind: "definition",
					},
					sources,
				}),
			);
			const tab =
				requestedTab !== undefined && tabs.includes(requestedTab)
					? requestedTab
					: ItemDetailTabEnumSchema.enum.Info;
			return {
				kind: "available",
				itemId: sources.targetDefinitionItemId,
				tab,
			};
		},
		[
			game,
		],
	);
};
