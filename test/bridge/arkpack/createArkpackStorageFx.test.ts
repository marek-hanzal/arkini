import { Cause, Effect, Exit, Option } from "effect";
import { describe, expect, it, vi } from "vitest";
import { ArkpackStorageError } from "~/bridge/arkpack/ArkpackStorageError";
import { createArkpackStorageFx } from "~/bridge/arkpack/createArkpackStorageFx";

describe("createArkpackStorageFx", () => {
	it("turns Electron filesystem rejection into one typed bridge error", async () => {
		const cause = new Error("disk unavailable");
		const storage = Effect.runSync(
			createArkpackStorageFx({
				api: {
					install: vi.fn(),
					list: vi.fn().mockRejectedValue(cause),
					read: vi.fn(),
					remove: vi.fn(),
				},
			}),
		);
		const exit = await Effect.runPromiseExit(storage.listFx);
		expect(Exit.isFailure(exit)).toBe(true);
		if (Exit.isSuccess(exit)) throw new Error("Expected storage failure.");
		const failure = Cause.failureOption(exit.cause);
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
