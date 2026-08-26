import { describe, expect, it } from "vitest";

import { ArkiniVersionSchema } from "~/engine/version/schema/ArkiniVersionSchema";
import { ArkpackVersionSchema } from "~/engine/version/schema/ArkpackVersionSchema";
import { ArkiniAppVersion } from "../../../shared/ArkiniAppMetadata";

describe("artifact version schemas", () => {
	it("keeps arkpack compatibility on a strict major.minor axis", () => {
		expect(ArkpackVersionSchema.safeParse("1.0").success).toBe(true);
		expect(ArkpackVersionSchema.safeParse("1.0.1").success).toBe(false);
		expect(ArkpackVersionSchema.safeParse("01.0").success).toBe(false);
	});

	it("accepts only this build's Arkini writer version", () => {
		expect(ArkiniVersionSchema.safeParse(ArkiniAppVersion).success).toBe(true);
		expect(ArkiniVersionSchema.safeParse("999.0.0").success).toBe(false);
	});
});
