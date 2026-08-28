import { Effect } from "effect";

import { GameEngineResourceFx } from "~/bridge/game/GameEngineResourceFx";

/** Joins installed Game ownership before any Editor game may be published. */
export const prepareEditorGameHandoffFx = GameEngineResourceFx.pipe(
	Effect.flatMap((service) => service.prepareEditorHandoffFx),
	Effect.withSpan("prepareEditorGameHandoffFx"),
);
