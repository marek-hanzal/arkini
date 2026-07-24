import { Layer } from "effect";

import { GameEngineResourceFx } from "~/bridge/game/GameEngineResourceFx";
import {
	createGameEngineResourceServiceFx,
	type createGameEngineResourceServiceFx as CreateGameEngineResourceServiceFx,
} from "~/bridge/game/createGameEngineResourceServiceFx";

/** Builds one independent scoped Game resource authority. */
export const GameEngineResourceLayer = (
	dependencies: CreateGameEngineResourceServiceFx.Dependencies,
) => Layer.effect(GameEngineResourceFx, createGameEngineResourceServiceFx(dependencies));
