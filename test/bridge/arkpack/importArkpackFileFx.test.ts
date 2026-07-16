import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

import { ArkpackLimits } from "~/bridge/arkpack/ArkpackLimits";
import { importArkpackFileFx } from "~/bridge/arkpack/importArkpackFileFx";

describe("importArkpackFileFx", () => {
	it("rejects oversized files before arrayBuffer allocates their contents", async () => {
		const arrayBuffer = vi.fn<() => Promise<ArrayBuffer>>();

		await expect(
			Effect.runPromise(
				importArkpackFileFx({
					file: {
						name: "oversized.arkpack",
						size: ArkpackLimits.maxCompressedBytes + 1,
						arrayBuffer,
					},
				}),
			),
		).rejects.toThrow("compressed limit");
		expect(arrayBuffer).not.toHaveBeenCalled();
	});
});
