import { describe, expect, it, vi } from "vitest";
import { DesktopArkpackStorage } from "~/bridge/arkpack/DesktopArkpackStorage";
import { ArkpackStorageError } from "~/bridge/arkpack/ArkpackStorageError";

describe("DesktopArkpackStorage", () => {
	it("turns Electron filesystem rejection into one typed bridge error", async () => {
		const cause = new Error("disk unavailable");
		const storage = new DesktopArkpackStorage({
			install: vi.fn(),
			list: vi.fn().mockRejectedValue(cause),
			read: vi.fn(),
			remove: vi.fn(),
		});

		await expect(storage.list()).rejects.toEqual(
			new ArkpackStorageError({
				operation: "list",
				cause,
			}),
		);
	});
});
