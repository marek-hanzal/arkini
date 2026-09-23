import { z } from "zod";
import { IdSchema } from "~/game-value/schema/IdSchema";

/** Active template identities are saved; their dimensions remain loaded-config authority. */
export const TemplateUidBySpaceSchema = z.record(z.string().regex(/^(0|[1-9][0-9]*)$/), IdSchema);
export type TemplateUidBySpaceSchema = typeof TemplateUidBySpaceSchema;
export namespace TemplateUidBySpaceSchema {
	export type Type = z.infer<TemplateUidBySpaceSchema>;
}
