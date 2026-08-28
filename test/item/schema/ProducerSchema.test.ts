import { describe, expect, it } from "vitest";

import { ProducerSchema } from "~/engine/item/schema/ProducerSchema";

describe("ProducerSchema", () => {
	it("requires a positive limit on parallel product lines", () => {
		expect(ProducerSchema.shape.maxQueueSize.safeParse(1).success).toBe(true);
		expect(ProducerSchema.shape.maxQueueSize.safeParse(0).success).toBe(false);
		expect(ProducerSchema.shape.maxQueueSize.parse(undefined)).toBe(1);
	});
});
