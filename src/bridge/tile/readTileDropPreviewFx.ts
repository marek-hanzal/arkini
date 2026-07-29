import { Effect } from "effect";

import type { GameEngine } from "~/bridge/game/GameEngine";
import { readEffectiveGridFootprintFx } from "~/engine/grid/fx/readEffectiveGridFootprintFx";
import type { GridSizeSchema } from "~/engine/grid/schema/GridSizeSchema";
import { readDropItemPreviewFx } from "~/engine/runtime/read/readDropItemPreviewFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";

export namespace readTileDropPreviewFx {
	export interface Props extends readDropItemPreviewFx.Props {
		readonly game: GameEngine;
	}

	export type Result = readDropItemPreviewFx.Result & {
		readonly destinationFootprint: GridSizeSchema.Type | null;
	};
}

/**
 * Reads one exact engine-owned drop preview through the renderer bridge.
 * Renderer occupancy or drag geometry must never manufacture drop legality.
 */
export const readTileDropPreviewFx = Effect.fn("readTileDropPreviewFx")(
	({ game, ...props }: readTileDropPreviewFx.Props) =>
		Effect.sync(
			(): readTileDropPreviewFx.Result =>
				game.readOrThrow(
					Effect.gen(function* () {
						const preview = yield* readDropItemPreviewFx(props);
						if (props.target.kind === "unsupported") {
							return {
								...preview,
								destinationFootprint: null,
							};
						}
						const runtime = yield* readRuntimeFx();
						const source = runtime.items.find(({ id }) => id === props.sourceItemId);
						return {
							...preview,
							destinationFootprint:
								source === undefined
									? null
									: yield* readEffectiveGridFootprintFx({
											authored: source.item.footprint,
											location: props.target.location,
										}),
						};
					}),
				),
		),
);
