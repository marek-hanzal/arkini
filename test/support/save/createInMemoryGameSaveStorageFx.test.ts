import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { createInMemoryGameSaveStorageFx } from "~test/support/save/createInMemoryGameSaveStorageFx";

const first = {
	packageId: "arkini",
};
const second = {
	packageId: "demo",
};

describe("createInMemoryGameSaveStorageFx", () => {
	it("isolates package saves and clears only the selected save", async () => {
		const storage = Effect.runSync(createInMemoryGameSaveStorageFx());
		await Effect.runPromise(
			storage.writeFx(
				first,
				new Uint8Array([
					1,
				]),
			),
		);
		await Effect.runPromise(
			storage.writeFx(
				second,
				new Uint8Array([
					2,
				]),
			),
		);
		await Effect.runPromise(storage.clearFx(first));
		expect(await Effect.runPromise(storage.readFx(first))).toBeNull();
		expect(await Effect.runPromise(storage.readFx(second))).toEqual(
			new Uint8Array([
				2,
			]),
		);
	});
});
