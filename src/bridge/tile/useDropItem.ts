import { useGameCommand } from "~/bridge/game/useGameCommand";
import { dropItemFx } from "~/engine/runtime/write/dropItemFx";

export namespace useDropItem {
	export type Props = dropItemFx.Props;
	export type Result = dropItemFx.Result;
}

/** Exposes the one public atomic item-drop command to the tile presentation layer. */
export const useDropItem = () => useGameCommand(dropItemFx);
