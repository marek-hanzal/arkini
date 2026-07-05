import { Effect } from "effect";
import { placeSingleGameSaveItemRequestProgramFx } from "~/placement/placeSingleGameSaveItemRequestProgramFx";
import { readSinglePlacementCreatedAtMs } from "~/placement/readSinglePlacementCreatedAtMs";
import { readSinglePlacementItemDefinitionFx } from "~/placement/readSinglePlacementItemDefinitionFx";
import type { PlaceSingleGameSaveItemRequestProps } from "~/placement/SingleGameSaveItemPlacementTypes";

export namespace placeSingleGameSaveItemRequestFx {
	export interface Props extends PlaceSingleGameSaveItemRequestProps {}
}

export const placeSingleGameSaveItemRequestFx = Effect.fn("placeSingleGameSaveItemRequestFx")(
	function* (props: placeSingleGameSaveItemRequestFx.Props) {
		const itemDefinition = yield* readSinglePlacementItemDefinitionFx({
			config: props.config,
			item: props.item,
		});
		return yield* placeSingleGameSaveItemRequestProgramFx({
			...props,
			createdAtMs: readSinglePlacementCreatedAtMs({
				item: props.item,
				itemDefinition,
				nowMs: props.nowMs,
			}),
			itemDefinition,
		});
	},
);
