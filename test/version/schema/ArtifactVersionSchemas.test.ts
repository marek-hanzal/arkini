import { describe, expect, it } from "vitest";

import { ArkiniVersionSchema } from "~/engine/version/schema/ArkiniVersionSchema";
import { ArkpackVersionSchema } from "~/engine/version/schema/ArkpackVersionSchema";

describe("artifact version schemas", () => {
	it("keeps arkpack compatibility on a strict major.minor axis", () => {
		expect(ArkpackVersionSchema.safeParse("1.0").success).toBe(true);
		expect(ArkpackVersionSchema.safeParse("1.0.1").success).toBe(false);
		expect(ArkpackVersionSchema.safeParse("01.0").success).toBe(false);
	});

	it("keeps Arkini writer provenance on a strict complete version", () => {
		expect(ArkiniVersionSchema.safeParse("1.0.0").success).toBe(true);
		expect(ArkiniVersionSchema.safeParse("1.0.0-dev.550.1").success).toBe(true);
		expect(ArkiniVersionSchema.safeParse("1.0").success).toBe(false);
		expect(ArkiniVersionSchema.safeParse("1.0.0-").success).toBe(false);
		expect(ArkiniVersionSchema.safeParse("01.0.0").success).toBe(false);
	});
});
