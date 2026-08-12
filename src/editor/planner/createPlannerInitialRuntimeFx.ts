import { Effect } from "effect";

import { GameConfigFx } from "~/engine/game/context/GameConfigFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { planStartFx } from "~/engine/start/fx/planStartFx";

/** Builds the planner's canonical immutable starting runtime through the gameplay start planner. */
export const createPlannerInitialRuntimeFx = Effect.fn("createPlannerInitialRuntimeFx")(
	(config: GameConfigSchema.Type) =>
		planStartFx({
			runtime: {
				cheats: {
					enabled: false,
					everEnabled: false,
					instantGameplay: false,
				},
				currentSpace: config.start.currentSpace,
				items: [],
				jobs: [],
				jobQueue: [],
			} satisfies RuntimeSchema.Type,
			start: config.start,
		}).pipe(Effect.provideService(GameConfigFx, config)),
);
