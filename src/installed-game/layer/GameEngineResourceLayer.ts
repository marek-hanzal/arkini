import { Layer } from "effect";

import { GameEngineResourceFx } from "~/installed-game/service/GameEngineResourceFx";
import {
	createGameEngineResourceServiceFx,
	type createGameEngineResourceServiceFx as CreateGameEngineResourceServiceFx,
} from "~/installed-game/fx/createGameEngineResourceServiceFx";

/** Builds one independent scoped Game resource authority. */
export const GameEngineResourceLayer = (
	dependencies: CreateGameEngineResourceServiceFx.Dependencies,
) => Layer.effect(GameEngineResourceFx, createGameEngineResourceServiceFx(dependencies));
