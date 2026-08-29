import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PngResourceLimits, validatePngResourceFx } from "~/renderer/arkpack/validatePngResourceFx";

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("validatePngResourceFx", () => {
	it("rejects bytes beyond the shared limit before decoding", async () => {
		const decode = vi.fn();
		vi.stubGlobal("createImageBitmap", decode);

		await expect(
			Effect.runPromise(
				validatePngResourceFx(new Uint8Array(PngResourceLimits.maxBytes + 1), "oversized"),
			),
		).rejects.toThrow("must be a valid bounded PNG image");
		expect(decode).not.toHaveBeenCalled();
	});
});
