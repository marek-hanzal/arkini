import { describe, expect, it } from "vitest";

import { ArkiniVersionSchema } from "~/engine/version/schema/ArkiniVersionSchema";
import { ArkpackVersionSchema } from "~/engine/version/schema/ArkpackVersionSchema";

describe("artifact version schemas", () => {
	it("keeps arkpack compatibility on a strict major.minor axis", () => {
		expect(ArkpackVersionSchema.safeParse("1.0").success).toBe(true);
		expect(ArkpackVersionSchema.safeParse("1.0.1").success).toBe(false);
		expect(ArkpackVersionSchema.safeParse("01.0").success).toBe(false);
	});

	it("accepts package semantic versions as Arkini writer versions", () => {
		expect(ArkiniVersionSchema.safeParse("0.5.0").success).toBe(true);
		expect(ArkiniVersionSchema.safeParse("0.6.0-beta.1+build.2").success).toBe(true);
		expect(ArkiniVersionSchema.safeParse("0.5").success).toBe(false);
	});
});
