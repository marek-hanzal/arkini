import { describe, expect, it, vi } from "vitest";
import { DesktopGameSaveStorage } from "~/bridge/save/DesktopGameSaveStorage";
import { GameSaveStorageError } from "~/bridge/save/GameSaveStorageError";

describe("DesktopGameSaveStorage", () => {
	it("turns Electron filesystem rejection into one typed bridge error", async () => {
		const cause = new Error("disk full");
		const storage = new DesktopGameSaveStorage({
			clear: vi.fn(),
			read: vi.fn(),
			write: vi.fn().mockRejectedValue(cause),
		});

		await expect(
			storage.write(
				{
					packageId: "arkini",
					contentHash: "a".repeat(64),
				},
				new Uint8Array([
					1,
				]),
			),
		).rejects.toEqual(
			new GameSaveStorageError({
				operation: "write",
				cause,
			}),
		);
	});
});
