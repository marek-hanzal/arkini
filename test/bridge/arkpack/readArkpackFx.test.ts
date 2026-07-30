import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { ArkpackLimits } from "~/bridge/arkpack/ArkpackLimits";
import { readArkpackFx } from "~/bridge/arkpack/readArkpackFx";
import { GameValidationError } from "~/engine/validation/error/GameValidationError";
import { encodeFx } from "~/engine/pack/fx/encodeFx";
import {
	createTestArkpack,
	testArkpackConfig,
} from "~test/bridge/arkpack/support/createTestArkpack";
import { gzipSync } from "node:zlib";

const trustedKeys = {
	keys: [],
};

describe("readArkpackFx", () => {
	it("validates one compressed data-only package and derives exact identity", async () => {
		const bytes = createTestArkpack();
		const first = await Effect.runPromise(
			readArkpackFx({
				bytes,
				filename: "bridge.arkpack",
				signature: {
					trustedKeys,
				},
				source: "imported",
			}),
		);
		const second = await Effect.runPromise(
			readArkpackFx({
				bytes,
				filename: "renamed.arkpack",
				signature: {
					trustedKeys,
				},
				source: "imported",
			}),
		);

		expect(first.descriptor).toMatchObject({
			packageId: first.descriptor.hash,
			gameId: "game:bridge",
			title: "Bridge game",
			game: "1.0",
			source: "imported",
		});
		expect(first.descriptor.packageId).toMatch(/^[a-f0-9]{64}$/);
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
				source: "imported",
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
					source: "imported",
				}),
			),
		).rejects.toThrow("compressed limit");
	});

	it("rejects semantically invalid packages before persistence", async () => {
		const invalid = {
			...testArkpackConfig,
			items: {
				...testArkpackConfig.items,
				water: {
					...testArkpackConfig.items.water,
					categoryId: "missing-category",
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

		const result = await Effect.runPromise(
			Effect.result(
				readArkpackFx({
					bytes: new Uint8Array(gzipSync(encoded)),
					signature: {
						trustedKeys,
					},
					source: "imported",
				}),
			),
		);

		expect(result._tag).toBe("Failure");
		if (result._tag === "Failure") {
			expect(result.failure).toBeInstanceOf(GameValidationError);
		}
	});
});
