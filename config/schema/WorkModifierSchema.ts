import { z } from "zod";
import { BonusOutputModifierSchema } from "./BonusOutputModifierSchema";
import { DurationModifierSchema } from "./DurationModifierSchema";

export const WorkModifierSchema = z.discriminatedUnion("kind", [
	DurationModifierSchema,
	BonusOutputModifierSchema,
]);
