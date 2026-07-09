import { z } from "zod";

import { NonEmptyStringSchema } from "~/v1/common/schema/NonEmptyStringSchema";

/**
 * A semantic label used to classify game items.
 *
 * Tags are deliberately open-ended. They support content grouping and later
 * rule selectors without coupling the schema to a centrally maintained enum.
 */
export const TagSchema = NonEmptyStringSchema.describe(
	"A non-empty semantic label used to classify a game item.",
);

export type TagSchema = typeof TagSchema;

export namespace TagSchema {
	export type Type = z.infer<TagSchema>;
}
