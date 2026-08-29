import { Cause, Effect, Exit, Option } from "effect";
import { describe, expect, it, vi } from "vitest";
import { ArkpackStorageError } from "~/renderer/arkpack/ArkpackStorageError";
import { createElectronArkpackStorageFx } from "~/renderer/arkpack/createElectronArkpackStorageFx";

describe("createElectronArkpackStorageFx", () => {
	it("turns Electron filesystem rejection into one typed transport error", async () => {
		const cause = new Error("disk unavailable");
		const storage = Effect.runSync(
			createElectronArkpackStorageFx({
				api: {
					install: vi.fn(),
					list: vi.fn().mockRejectedValue(cause),
					openUserDirectory: vi.fn(),
					read: vi.fn(),
					remove: vi.fn(),
				},
			}),
		);
		const exit = await Effect.runPromiseExit(storage.listFx);
		expect(Exit.isFailure(exit)).toBe(true);
		if (Exit.isSuccess(exit)) throw new Error("Expected storage failure.");
		const failure = Cause.findErrorOption(exit.cause);
		expect(Option.isSome(failure)).toBe(true);
		if (Option.isNone(failure)) throw new Error("Expected typed storage failure.");
		expect(failure.value).toEqual(
			new ArkpackStorageError({
				operation: "list",
				cause,
			}),
		);
	});
});
