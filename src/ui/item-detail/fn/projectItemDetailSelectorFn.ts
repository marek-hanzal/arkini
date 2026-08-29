import type { GameEngine } from "~/renderer/game/GameEngine";
import type { SelectorSchema } from "~/engine/selector/schema/SelectorSchema";

export namespace projectItemDetailSelectorFn {
	export interface Props {
		readonly game: GameEngine;
		readonly selector: SelectorSchema.Type;
	}
}

/** Projects one authored selector into its stable renderer label. */
export const projectItemDetailSelectorFn = ({
	game,
	selector,
}: projectItemDetailSelectorFn.Props) => ({
	kind: "item" as const,
	label: game.config.items[selector.itemId]?.title ?? selector.itemId,
});
