import { describe, expect, it } from "vitest";
import { readAcceptedTransferQuantity } from "~/quantity/readAcceptedTransferQuantity";

describe("readAcceptedTransferQuantity", () => {
	it("caps transfer quantity by source availability and target capacity", () => {
		expect(
			readAcceptedTransferQuantity({
				availableQuantity: 5,
				remainingCapacity: 1,
			}),
		).toBe(1);
		expect(
			readAcceptedTransferQuantity({
				availableQuantity: 2,
				remainingCapacity: 7,
			}),
		).toBe(2);
	});

	it("returns zero for exhausted targets", () => {
		expect(
			readAcceptedTransferQuantity({
				availableQuantity: 5,
				remainingCapacity: 0,
			}),
		).toBe(0);
		expect(
			readAcceptedTransferQuantity({
				availableQuantity: 5,
				remainingCapacity: -3,
			}),
		).toBe(0);
	});
});
