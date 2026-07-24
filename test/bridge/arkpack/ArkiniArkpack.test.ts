import { describe, expect, it } from "vitest";

import { ArkiniArkpack } from "~/bridge/arkpack/ArkiniArkpack";
import { DemoArkpack } from "~/bridge/arkpack/DemoArkpack";

describe("ArkiniArkpack", () => {
	it("uses the native Arkini package route identity", () => {
		expect(ArkiniArkpack.packageId).toBe("arkini");
		expect(ArkiniArkpack.descriptor).toMatchObject({
			packageId: "arkini",
			gameId: "arkini",
			title: "Arkini",
			configVersion: "1.0",
			trust: {
				type: "official",
				keyId: "arkini-official-2026-01",
			},
			source: "built-in",
		});
		expect(ArkiniArkpack.descriptor.contentHash).toMatch(/^[a-f0-9]{64}$/);
		expect(ArkiniArkpack.descriptor.compressedSize).toBeGreaterThan(0);
	});

	it("keeps the bundled demo explicitly unsigned and external", () => {
		expect(DemoArkpack.packageId).toBe("demo");
		expect(DemoArkpack.descriptor).toMatchObject({
			packageId: "demo",
			gameId: "demo",
			title: "Arkini Trust Demo",
			trust: {
				type: "external",
				reason: "unsigned",
			},
			source: "built-in",
		});
		expect("signatureUrl" in DemoArkpack).toBe(false);
	});
});
