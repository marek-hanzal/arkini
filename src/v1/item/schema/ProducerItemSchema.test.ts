import { describe, expect, it } from "vitest";

import { ProducerItemSchema } from "./ProducerItemSchema";

describe("ProducerItemSchema", () => {
	it("requires a positive limit on parallel product lines", () => {
		expect(ProducerItemSchema.shape.maxQueueSize.safeParse(1).success).toBe(true);
		expect(ProducerItemSchema.shape.maxQueueSize.safeParse(0).success).toBe(false);
		expect(ProducerItemSchema.shape.maxQueueSize.parse(undefined)).toBe(1);
	});
});
