import { Effect } from "effect";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { importArkpackFx } from "~/bridge/arkpack/importArkpackFx";
import { loadArkpackFx } from "~/bridge/arkpack/loadArkpackFx";
import { MemoryArkpackStorage } from "~/bridge/arkpack/MemoryArkpackStorage";
import { encodeFx } from "~/engine/pack/fx/encodeFx";
import {
	createTestArkpack,
	testArkpackConfig,
} from "~test/bridge/arkpack/support/createTestArkpack";

describe("importArkpackFx", () => {
	it("persists only a fully validated binary and exact load revalidates it", async () => {
		const storage = new MemoryArkpackStorage();
		const bytes = createTestArkpack();
		const descriptor = await Effect.runPromise(
			importArkpackFx({
				bytes,
				filename: "test.arkpack",
				storage,
			}),
		);
		const loaded = await Effect.runPromise(
			loadArkpackFx({
				packageId: descriptor.packageId,
				storage,
			}),
		);
		expect(loaded.descriptor.contentHash).toBe(descriptor.packageId);
		expect(loaded.payload.config).toEqual(testArkpackConfig);
	});

	it("leaves no catalog or payload record after validation fails", async () => {
		const storage = new MemoryArkpackStorage();
		const invalid = {
			...testArkpackConfig,
			items: {
				...testArkpackConfig.items,
				water: {
					...testArkpackConfig.items.water,
					categoryId: "missing",
				},
			},
		};
		const encoded = Effect.runSync(
			encodeFx({
				config: invalid,
				resources: [
					{
						id: "hero",
						mime: "image/png",
						bytes: new Uint8Array([
							1,
						]),
					},
					{
						id: "asset:water",
						mime: "image/png",
						bytes: new Uint8Array([
							2,
						]),
					},
				],
			}),
		);
		await expect(
			Effect.runPromise(
				importArkpackFx({
					bytes: new Uint8Array(gzipSync(encoded)),
					filename: "invalid.arkpack",
					storage,
				}),
			),
		).rejects.toBeDefined();
		expect(await storage.list()).toEqual([]);
	});
});
