import { z } from "zod";

import { RuntimeItemSchema } from "~/v1/runtime/schema/RuntimeItemSchema";

/**
 * Runtime items selected by one query evaluation.
 *
 * An empty array is an intentional valid result when no runtime item satisfies
 * the query. Consumers decide whether an empty result is acceptable for their
 * own operation.
 */
export const QueryResultSchema = z.array(RuntimeItemSchema).meta({
	id: "QueryResultSchema",
	description: "The intentionally possibly empty runtime items selected by one query evaluation.",
});

export type QueryResultSchema = typeof QueryResultSchema;

export namespace QueryResultSchema {
	export type Type = z.infer<QueryResultSchema>;
}
