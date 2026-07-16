import { describe, expect, it } from "vitest";

import { QueryResultSchema } from "~/engine/query/schema/QueryResultSchema";

describe("QueryResultSchema", () => {
	it("intentionally accepts an empty result when no runtime item matches", () => {
		// An empty query result is a normal lookup outcome. Consumers such as When
		// decide what zero matches mean, so this must remain a possibly empty array.
		expect(QueryResultSchema.safeParse([]).success).toBe(true);
	});
});
