import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { createInMemoryArkpackStorageFx } from "~test/arkpack-support/fx/createInMemoryArkpackStorageFx";

const packageId = "package:\ud800";

describe("createInMemoryArkpackStorageFx", () => {
	it("returns isolated byte copies from both catalog and exact reads", async () => {
		const storage = Effect.runSync(createInMemoryArkpackStorageFx());
		const bytes = new Uint8Array([
			1,
			2,
			3,
		]).buffer;
		await Effect.runPromise(storage.writeFx(packageId, bytes));
		expect(await Effect.runPromise(storage.listFx)).toEqual([
			expect.objectContaining({
				packageId,
				filename: "package%3A%ED%A0%80.arkpack",
				source: "user",
			}),
		]);
		const loaded = await Effect.runPromise(storage.readFx(packageId));
		expect(new Uint8Array(loaded[0]?.bytes ?? new ArrayBuffer())).toEqual(
			new Uint8Array([
				1,
				2,
				3,
			]),
		);
		new Uint8Array(loaded[0]?.bytes ?? new ArrayBuffer())[0] = 9;
		expect(
			new Uint8Array(
				(await Effect.runPromise(storage.readFx(packageId)))[0]?.bytes ?? new ArrayBuffer(),
			)[0],
		).toBe(1);
	});
});
