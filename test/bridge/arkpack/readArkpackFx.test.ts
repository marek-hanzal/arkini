import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ArkpackLimits } from "../../../shared/ArkpackLimits";
import { readArkpackFx } from "~/bridge/arkpack/readArkpackFx";
import { GameValidationError } from "~/engine/validation/error/GameValidationError";
import { encodeFx } from "~/engine/pack/fx/encodeFx";
import {
	createTestArkpack,
	testArkpackConfig,
} from "~test/bridge/arkpack/support/createTestArkpack";
import {
	createTestPngBytes,
	installTestPngDecoder,
} from "~test/bridge/arkpack/support/createTestPngBytes";
import { gzipSync } from "node:zlib";

const trustedKeys = {
	keys: [],
};

beforeEach(() => {
	installTestPngDecoder();
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("readArkpackFx", () => {
	it("keeps package identity separate from both content and game identity", async () => {
		const bytes = createTestArkpack();
		const first = await Effect.runPromise(
			readArkpackFx({
				bytes,
				filename: "bridge.arkpack",
				signature: {
					trustedKeys,
				},
				source: "user",
			}),
		);
		const second = await Effect.runPromise(
			readArkpackFx({
				bytes,
				filename: "renamed.arkpack",
				signature: {
					trustedKeys,
				},
				source: "user",
			}),
		);

		expect(first.descriptor).toMatchObject({
			packageId: "package:bridge",
			gameId: "game:bridge",
			title: "Bridge game",
			game: "1.0",
			source: "user",
		});
		expect(first.descriptor.contentHash).toMatch(/^[a-f0-9]{64}$/);
		expect(second.descriptor.packageId).toBe(first.descriptor.packageId);
		expect(first.payload.config).toEqual(testArkpackConfig);
	});

	it("surfaces malformed signature metadata without downgrading it to unsigned", async () => {
		const loaded = await Effect.runPromise(
			readArkpackFx({
				bytes: createTestArkpack(),
				signature: {
					metadata: {
						nope: true,
					},
					trustedKeys,
				},
				source: "user",
			}),
		);

		expect(loaded.descriptor.trust).toEqual({
			type: "invalid",
			reason: "malformed-signature",
		});
	});

	it("rejects oversized non-File byte inputs at the reader boundary", async () => {
		await expect(
			Effect.runPromise(
				readArkpackFx({
					bytes: new Uint8Array(ArkpackLimits.maxCompressedBytes + 1),
					signature: {
						trustedKeys,
					},
					source: "user",
				}),
			),
		).rejects.toThrow("compressed limit");
	});

	it("rejects PNG resources whose actual bytes cannot decode", async () => {
		vi.mocked(createImageBitmap).mockRejectedValueOnce(new Error("decode failed"));
		const fakePng = new Uint8Array(24);
		fakePng.set([
			137,
			80,
			78,
			71,
			13,
			10,
			26,
			10,
		]);
		const encoded = Effect.runSync(
			encodeFx({
				packageId: "package:invalid-png",
				config: testArkpackConfig,
				resources: [
					{
						id: "hero",
						mime: "image/png",
						bytes: fakePng,
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
				readArkpackFx({
					bytes: new Uint8Array(gzipSync(encoded)),
					signature: {
						trustedKeys,
					},
					source: "user",
				}),
			),
		).rejects.toThrow("must decode as a valid PNG image");
	});

	it("rejects semantically invalid packages before persistence", async () => {
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
				packageId: "package:invalid-config",
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

		const result = await Effect.runPromise(
			Effect.result(
				readArkpackFx({
					bytes: new Uint8Array(gzipSync(encoded)),
					signature: {
						trustedKeys,
					},
					source: "user",
				}),
			),
		);

		expect(result._tag).toBe("Failure");
		if (result._tag === "Failure") {
			expect(result.failure).toBeInstanceOf(GameValidationError);
		}
	});
});
