import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { ArkiniArkpack } from "~/bridge/arkpack/ArkiniArkpack";
import { DemoArkpack } from "~/bridge/arkpack/DemoArkpack";
import { ArkpackSignatureSchema } from "~/engine/pack/schema/ArkpackSignatureSchema";

describe("ArkiniArkpack", () => {
	it("uses the native Arkini identity and generated signature key", async () => {
		const signature = ArkpackSignatureSchema.parse(
			JSON.parse(await readFile("game/arkini.game.arkpack.sig", "utf8")) as unknown,
		);
		expect(ArkiniArkpack.packageId).toBe("arkini");
		expect(ArkiniArkpack.descriptor).toMatchObject({
			packageId: "arkini",
			gameId: "arkini",
			title: "Arkini",
			configVersion: "1.0",
			trust: {
				type: "official",
				keyId: signature.keyId,
			},
			source: "built-in",
		});
		expect(ArkiniArkpack.descriptor.contentHash).toMatch(/^[a-f0-9]{64}$/);
		expect(ArkiniArkpack.descriptor.compressedSize).toBeGreaterThan(0);
		expect(ArkiniArkpack.signatureUrl).not.toMatch(/^data:/);
	});

	it("keeps the bundled demo explicitly unsigned and external", () => {
		expect(DemoArkpack.packageId).toBe("demo");
		expect(DemoArkpack.descriptor).toMatchObject({
			packageId: "demo",
			gameId: "demo",
			title: "Arkini Multi-slot Experiment",
			trust: {
				type: "external",
				reason: "unsigned",
			},
			source: "built-in",
		});
		expect("signatureUrl" in DemoArkpack).toBe(false);
	});
});
