import { Effect } from "effect";
import { match } from "ts-pattern";

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
		Effect.succeed(
			match(selector)
				.with(
					{
						type: "item",
					},
					({ itemId }) => ({
						kind: "item" as const,
						label: game.config.items[itemId]?.title ?? itemId,
					}),
				)
				.with(
					{
						type: "tag",
					},
					({ tag }) => ({
						kind: "tag" as const,
						label: tag,
					}),
				)
				.exhaustive(),
		),
);
