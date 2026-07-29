import { describe, expect, it } from "vitest";

import { DeliveryPurposeSchema } from "~/engine/delivery/schema/DeliveryPurposeSchema";
import { DeliveryStartIntentSchema } from "~/engine/delivery/schema/DeliveryStartIntentSchema";

describe("legacy delivery source compatibility", () => {
	it("strips the former player source from persisted start facts", () => {
		expect(
			DeliveryPurposeSchema.parse({
				kind: "fill-and-try-start",
				ownerItemId: "runtime:producer",
				lineId: "line:produce",
				source: "player",
			}),
		).toEqual({
			kind: "fill-and-try-start",
			ownerItemId: "runtime:producer",
			lineId: "line:produce",
		});
		expect(
			DeliveryStartIntentSchema.parse({
				ownerItemId: "runtime:producer",
				lineId: "line:produce",
				source: "player",
			}),
		).toEqual({
			ownerItemId: "runtime:producer",
			lineId: "line:produce",
		});
	});
});
