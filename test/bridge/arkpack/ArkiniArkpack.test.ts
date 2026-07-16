import { describe, expect, it } from "vitest";

import { ArkiniArkpack } from "~/bridge/arkpack/ArkiniArkpack";

describe("ArkiniArkpack", () => {
	it("uses the native Arkini package route identity", () => {
		expect(ArkiniArkpack.packageId).toBe("arkini");
	});
});
