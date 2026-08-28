import { Effect } from "effect";

import type { GameEngine } from "~/bridge/game/GameEngine";
import type { SelectorSchema } from "~/engine/selector/schema/SelectorSchema";

export namespace projectItemDetailSelectorFx {
	export interface Props {
		readonly game: GameEngine;
		readonly selector: SelectorSchema.Type;
	}
}

/** Projects one authored selector into its stable renderer label. */
export const projectItemDetailSelectorFx = Effect.fn("projectItemDetailSelectorFx")(
	({ game, selector }: projectItemDetailSelectorFx.Props) =>
		Effect.succeed({
			kind: "item" as const,
			label: game.config.items[selector.itemId]?.title ?? selector.itemId,
		}),
);
