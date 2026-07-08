import { z } from "zod";
import { ChanceOutputEntrySchema } from "./ChanceOutputEntrySchema";
import { GuaranteedOutputEntrySchema } from "./GuaranteedOutputEntrySchema";

export const OutputEntrySchema = z.discriminatedUnion("kind", [
	GuaranteedOutputEntrySchema,
	ChanceOutputEntrySchema,
]);
