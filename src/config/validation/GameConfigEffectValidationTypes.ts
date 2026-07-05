import { z } from "zod";
import { GameDropEffectSchema } from "~/config/schema/GameDropEffectSchema";
import { GameLineEffectSchema } from "~/config/schema/GameLineEffectSchema";
import type { GameConfigIssuePath } from "~/config/validation/GameConfigValidationCommon";

export type GameEffectValidationEntities = {
	grantIds: readonly string[];
	hasItem: (itemId: string) => boolean;
	itemIds: readonly string[];
};

export type CommonGameLineEffect = z.infer<typeof GameLineEffectSchema>;
export type GameDropEffect = z.infer<typeof GameDropEffectSchema>;

export type GameDropEffectValidationProps = {
	ctx: z.RefinementCtx;
	effect: GameDropEffect;
	effectIndex: number;
	entities: GameEffectValidationEntities;
	path: GameConfigIssuePath;
};
