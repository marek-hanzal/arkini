import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { createInMemoryArkpackStorageFx } from "~test/support/arkpack/createInMemoryArkpackStorageFx";

const descriptor = {
	packageId: "a".repeat(64),
	contentHash: "a".repeat(64),
	gameId: "game:test",
	title: "Test",
	configVersion: "1.0" as const,
	compressedSize: 3,
	trust: {
		type: "external",
		reason: "unsigned",
	} as const,
	source: "imported" as const,
	filename: "test.arkpack",
	importedAtMs: 1,
};

describe("createInMemoryArkpackStorageFx", () => {
	it("keeps metadata listing separate from exact copied payload reads", async () => {
		const storage = Effect.runSync(createInMemoryArkpackStorageFx());
		const bytes = new Uint8Array([
			1,
			2,
			3,
		]).buffer;
		await Effect.runPromise(storage.writeFx(descriptor, bytes));
		expect(await Effect.runPromise(storage.listFx)).toEqual([
			descriptor,
		]);
		const loaded = await Effect.runPromise(storage.readFx(descriptor.packageId));
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
				(await Effect.runPromise(storage.readFx(descriptor.packageId)))?.bytes ??
					new ArrayBuffer(),
			)[0],
		).toBe(1);
	});
});
