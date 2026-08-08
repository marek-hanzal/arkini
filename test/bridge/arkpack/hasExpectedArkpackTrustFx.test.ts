import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { hasExpectedArkpackTrustFx } from "~/bridge/arkpack/hasExpectedArkpackTrustFx";
import type { ArkpackTrustSchema } from "~/engine/pack/schema/ArkpackTrustSchema";

const official: ArkpackTrustSchema.Type = {
	type: "official",
	keyId: "test-key",
};
const external: ArkpackTrustSchema.Type = {
	type: "external",
	reason: "unsigned",
};
const invalid: ArkpackTrustSchema.Type = {
	type: "invalid",
	reason: "invalid-signature",
	keyId: "test-key",
};

describe("hasExpectedArkpackTrustFx", () => {
	it.each([
		official,
		external,
		invalid,
	])("accepts equal %s trust metadata", (trust) => {
		expect(
			Effect.runSync(
				hasExpectedArkpackTrustFx({
					actual: trust,
					expected: trust,
				}),
			),
		).toBe(true);
	});

	it("rejects different variants and same-variant metadata drift", () => {
		expect(
			Effect.runSync(
				hasExpectedArkpackTrustFx({
					actual: official,
					expected: external,
				}),
			),
		).toBe(false);
		expect(
			Effect.runSync(
				hasExpectedArkpackTrustFx({
					actual: official,
					expected: {
						...official,
						keyId: "other-key",
					},
				}),
			),
		).toBe(false);
	});
});
