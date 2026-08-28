import { Effect } from "effect";
import { gzipSync } from "node:zlib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { importArkpackFx } from "~/bridge/arkpack/importArkpackFx";
import { loadArkpackFx } from "~/bridge/arkpack/loadArkpackFx";
import { encodeFx } from "~/engine/pack/fx/encodeFx";
import { encodeArkpackEnvelopeFx } from "~/engine/pack/fx/encodeArkpackEnvelopeFx";
import { ArkiniAppVersion } from "../../../shared/ArkiniAppMetadata";
import {
	createTestArkpack,
	testArkpackConfig,
} from "~test/bridge/arkpack/support/createTestArkpack";
import {
	createTestPngBytes,
	installTestPngDecoder,
} from "~test/bridge/arkpack/support/createTestPngBytes";
import { createInMemoryArkpackStorageFx } from "~test/support/arkpack/createInMemoryArkpackStorageFx";

beforeEach(() => {
	installTestPngDecoder();
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("importArkpackFx", () => {
	it("rejects bytes for a different canonical package before persistence", async () => {
		const storage = Effect.runSync(createInMemoryArkpackStorageFx());
		await expect(
			Effect.runPromise(
				importArkpackFx({
					bytes: createTestArkpack(),
					filename: "built.arkpack",
					packageId: "package:other",
					storage,
				}),
			),
		).rejects.toThrow("config declares game:bridge");
		expect(await Effect.runPromise(storage.listFx)).toEqual([]);
	});

	it("persists only a fully validated binary and exact load revalidates it", async () => {
		const storage = Effect.runSync(createInMemoryArkpackStorageFx());
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
		expect(loaded.descriptor).toMatchObject({
			packageId: descriptor.packageId,
			contentHash: descriptor.contentHash,
		});
		expect(descriptor.packageId).toBe(testArkpackConfig.meta.id);
		expect(loaded.payload.config).toEqual(testArkpackConfig);
	});

	it("leaves no catalog or payload record after validation fails", async () => {
		const storage = Effect.runSync(createInMemoryArkpackStorageFx());
		const invalid = {
			...testArkpackConfig,
			start: {
				...testArkpackConfig.start,
				board: testArkpackConfig.start.board.map((entry) => ({
					...entry,
					itemId: "missing",
				})),
			},
		};
		const encoded = Effect.runSync(
			encodeFx({
				version: "1.0",
				arkini: ArkiniAppVersion,
				config: invalid,
				resources: [
					{
						id: "hero",
						mime: "image/png",
						bytes: createTestPngBytes(),
					},
					{
						id: "asset:water",
						mime: "image/png",
						bytes: createTestPngBytes(),
					},
				],
			}),
		);
		await expect(
			Effect.runPromise(
				importArkpackFx({
					bytes: Effect.runSync(
						encodeArkpackEnvelopeFx({
							payload: new Uint8Array(gzipSync(encoded)),
						}),
					),
					filename: "invalid.arkpack",
					storage,
				}),
			),
		).rejects.toBeDefined();
		expect(await Effect.runPromise(storage.listFx)).toEqual([]);
	});
});
