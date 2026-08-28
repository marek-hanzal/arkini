import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

import { ArkpackLimits } from "../../../shared/ArkpackLimits";
import { importArkpackFileFx } from "~/renderer/arkpack/importArkpackFileFx";

describe("importArkpackFileFx", () => {
	it("rejects oversized files before arrayBuffer allocates their contents", async () => {
		const arrayBuffer = vi.fn<() => Promise<ArrayBuffer>>();

		await expect(
			Effect.runPromise(
				importArkpackFileFx({
					file: {
						name: "oversized.arkpack",
						size: ArkpackLimits.maxArkpackBytes + 1,
						arrayBuffer,
					},
				}),
			),
		).rejects.toThrow("byte limit");
		expect(arrayBuffer).not.toHaveBeenCalled();
	});
});
