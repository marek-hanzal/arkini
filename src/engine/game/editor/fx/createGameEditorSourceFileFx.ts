import { Effect } from "effect";

import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { createEditorJsonSourceFileFx } from "~/engine/source/editor/fx/createEditorJsonSourceFileFx";

/** Projects completed game-wide fields into the editor's root `game.json` fragment. */
export const createGameEditorSourceFileFx = Effect.fn("createGameEditorSourceFileFx")(
	(config: GameConfigSchema.Type) =>
		createEditorJsonSourceFileFx({
			path: "game.json",
			value: {
				meta: config.meta,
				resources: config.resources,
				start: config.start,
				categories: config.categories,
				version: config.version,
			},
		}),
);
