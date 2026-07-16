import type { z } from "zod";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameSave } from "~/engine/model/GameSaveShapeSchema";

export const addSaveIssue = (ctx: z.RefinementCtx, path: (string | number)[], message: string) => {
	ctx.addIssue({
		code: "custom",
		message,
		path: [
			"save",
			...path,
		],
	});
};

export type GameSaveValidationContext = {
	config: GameConfig;
	ctx: z.RefinementCtx;
	save: GameSave;
};
