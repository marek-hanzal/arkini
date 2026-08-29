import { Layer } from "effect";

import { GameEngineResourceFx } from "~/renderer/game/resource/GameEngineResourceFx";
import {
	createGameEngineResourceServiceFx,
	type createGameEngineResourceServiceFx as CreateGameEngineResourceServiceFx,
} from "~/renderer/game/resource/createGameEngineResourceServiceFx";

/** Builds one independent scoped Game resource authority. */
export const GameEngineResourceLayer = (
	dependencies: CreateGameEngineResourceServiceFx.Dependencies,
) => Layer.effect(GameEngineResourceFx, createGameEngineResourceServiceFx(dependencies));
