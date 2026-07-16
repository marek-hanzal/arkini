import { describe, expect, it } from "vitest";
import { MemoryArkpackStorage } from "~/bridge/arkpack/MemoryArkpackStorage";

const descriptor = {
	packageId: "a".repeat(64),
	contentHash: "a".repeat(64),
	gameId: "game:test",
	title: "Test",
	configVersion: "1.0" as const,
	compressedSize: 3,
	source: "imported" as const,
	filename: "test.arkpack",
	importedAtMs: 1,
};

describe("MemoryArkpackStorage", () => {
	it("keeps metadata listing separate from exact copied payload reads", async () => {
		const storage = new MemoryArkpackStorage();
		const bytes = new Uint8Array([
			1,
			2,
			3,
		]).buffer;
		await storage.write(descriptor, bytes);
		expect(await storage.list()).toEqual([
			descriptor,
		]);
		const loaded = await storage.read(descriptor.packageId);
		expect(new Uint8Array(loaded?.bytes ?? new ArrayBuffer())).toEqual(
			new Uint8Array([
				1,
				2,
				3,
			]),
		);
		new Uint8Array(loaded?.bytes ?? new ArrayBuffer())[0] = 9;
		expect(
			new Uint8Array(
				(await storage.read(descriptor.packageId))?.bytes ?? new ArrayBuffer(),
			)[0],
		).toBe(1);
	});
});
