import { describe, expect, it } from "vitest";
import { MemoryGameSaveStorage } from "~/bridge/save/MemoryGameSaveStorage";

const first = {
	packageId: "arkini",
	contentHash: "a".repeat(64),
};
const second = {
	packageId: "arkini",
	contentHash: "b".repeat(64),
};

describe("MemoryGameSaveStorage", () => {
	it("isolates exact package/hash keys and clears only the selected save", async () => {
		const storage = new MemoryGameSaveStorage();
		await storage.write(
			first,
			new Uint8Array([
				1,
			]),
		);
		await storage.write(
			second,
			new Uint8Array([
				2,
			]),
		);
		await storage.clear(first);
		expect(await storage.read(first)).toBeNull();
		expect(await storage.read(second)).toEqual(
			new Uint8Array([
				2,
			]),
		);
	});
});
