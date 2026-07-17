import { describe, expect, it } from "vitest";

import { ArkiniArkpack } from "~/bridge/arkpack/ArkiniArkpack";

describe("ArkiniArkpack", () => {
	it("uses the native Arkini package route identity", () => {
		expect(ArkiniArkpack.packageId).toBe("arkini");
		expect(ArkiniArkpack.descriptor).toMatchObject({
			packageId: "arkini",
			gameId: "arkini",
			title: "Arkini",
			configVersion: "1.0",
			source: "built-in",
		});
		expect(ArkiniArkpack.descriptor.contentHash).toMatch(/^[a-f0-9]{64}$/);
		expect(ArkiniArkpack.descriptor.compressedSize).toBeGreaterThan(0);
	});
});
