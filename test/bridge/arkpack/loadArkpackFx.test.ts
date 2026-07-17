import { readFile } from "node:fs/promises";
import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ArkiniArkpack } from "~/bridge/arkpack/ArkiniArkpack";
import { loadArkpackFx } from "~/bridge/arkpack/loadArkpackFx";
import { createTestArkpack } from "~test/bridge/arkpack/support/createTestArkpack";

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("loadArkpackFx official package", () => {
	it("reads and fully revalidates the selected bundled binary against catalog metadata", async () => {
		const bytes = await readFile("game/arkini.game.arkpack");
		const fetch = vi.fn().mockResolvedValue(new Response(bytes));
		vi.stubGlobal("fetch", fetch);

		const loaded = await Effect.runPromise(
			loadArkpackFx({
				packageId: ArkiniArkpack.packageId,
			}),
		);

		expect(fetch).toHaveBeenCalledOnce();
		expect(fetch).toHaveBeenCalledWith(ArkiniArkpack.url);
		expect(loaded.descriptor).toEqual(ArkiniArkpack.descriptor);
		expect(loaded.payload.config.meta.id).toBe("arkini");
	});

	it("rejects a bundled binary that does not match the generated catalog metadata", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(createTestArkpack())));

		await expect(
			Effect.runPromise(
				loadArkpackFx({
					packageId: ArkiniArkpack.packageId,
				}),
			),
		).rejects.toThrow("metadata does not match");
	});
});
