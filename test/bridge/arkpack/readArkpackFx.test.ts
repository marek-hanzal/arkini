import { gzipSync } from "node:zlib";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ArkpackLimits } from "../../../shared/ArkpackLimits";
import { readArkpackFx } from "~/bridge/arkpack/readArkpackFx";
import { GameValidationError } from "~/engine/validation/error/GameValidationError";
import { encodeFx } from "~/engine/pack/fx/encodeFx";
import { encodeArkpackEnvelopeFx } from "~/engine/pack/fx/encodeArkpackEnvelopeFx";
import {
	createTestArkpack,
	testArkpackConfig,
} from "~test/bridge/arkpack/support/createTestArkpack";
import {
	createTestPngBytes,
	installTestPngDecoder,
} from "~test/bridge/arkpack/support/createTestPngBytes";
import { ArkiniAppVersion } from "../../../shared/ArkiniAppMetadata";
import { ArkiniVersionIncompatibleError } from "~/engine/version/ArkiniVersionAdmission";

const writerMajor = ArkiniAppVersion.slice(0, ArkiniAppVersion.indexOf("."));

beforeEach(() => {
	installTestPngDecoder();
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("readArkpackFx", () => {
	it.each([
		`${writerMajor}.0.0`,
		`${writerMajor}.999.999`,
	])("admits a structurally current same-major writer %s", async (arkini) => {
		const loaded = await Effect.runPromise(
			readArkpackFx({
				bytes: createTestArkpack(
					testArkpackConfig,
					testArkpackConfig.meta.id,
					"1.0",
					arkini,
				),
				provenance: {
					type: "community",
				},
				source: "user",
			}),
		);

		expect(loaded.descriptor.arkini).toBe(arkini);
	});

	it("rejects a different writer major with a typed incompatibility", async () => {
		const arkini = `${Number(writerMajor) + 1}.0.0`;
		await expect(
			Effect.runPromise(
				readArkpackFx({
					bytes: createTestArkpack(
						testArkpackConfig,
						testArkpackConfig.meta.id,
						"1.0",
						arkini,
					),
					provenance: {
						type: "community",
					},
					source: "user",
				}),
			),
		).rejects.toBeInstanceOf(ArkiniVersionIncompatibleError);
	});

	it("derives package identity from the game config independently of the filename", async () => {
		const bytes = createTestArkpack();
		const first = await Effect.runPromise(
			readArkpackFx({
				bytes,
				filename: "bridge.arkpack",
				provenance: {
					type: "community",
				},
				source: "user",
			}),
		);
		const second = await Effect.runPromise(
			readArkpackFx({
				bytes,
				filename: "renamed.arkpack",
				provenance: {
					type: "community",
				},
				source: "user",
			}),
		);

		expect(first.descriptor).toMatchObject({
			packageId: "game:bridge",
			title: "Bridge game",
			version: "1.0",
			arkini: ArkiniAppVersion,
			source: "user",
		});
		expect(first.descriptor.contentHash).toMatch(/^[a-f0-9]{64}$/);
		expect(second.descriptor.packageId).toBe(first.descriptor.packageId);
		expect(first.payload.config).toEqual(testArkpackConfig);
	});

	it("preserves provenance independently of payload validation", async () => {
		const loaded = await Effect.runPromise(
			readArkpackFx({
				bytes: createTestArkpack(),
				provenance: {
					type: "official",
				},
				source: "user",
			}),
		);

		expect(loaded.descriptor.provenance).toEqual({
			type: "official",
		});
	});

	it("plays valid gameplay with malformed or oversized proof bytes", async () => {
		const unsigned = createTestArkpack();
		const withSuffix = (suffix: Uint8Array) => {
			const bytes = new Uint8Array(unsigned.byteLength + suffix.byteLength);
			bytes.set(unsigned);
			bytes.set(suffix, unsigned.byteLength);
			return bytes;
		};
		const malformed = withSuffix(new TextEncoder().encode("not-json"));
		const oversized = withSuffix(new Uint8Array(ArkpackLimits.maxProofBytes + 1));
		const load = (bytes: Uint8Array) =>
			Effect.runPromise(
				readArkpackFx({
					bytes,
					provenance: {
						type: "community",
					},
					source: "user",
				}),
			);

		const [plain, malformedProof, oversizedProof] = await Promise.all([
			load(unsigned),
			load(malformed),
			load(oversized),
		]);
		expect(malformedProof.descriptor.contentHash).toBe(plain.descriptor.contentHash);
		expect(oversizedProof.descriptor.contentHash).toBe(plain.descriptor.contentHash);
	});

	it("rejects oversized non-File byte inputs at the reader boundary", async () => {
		await expect(
			Effect.runPromise(
				readArkpackFx({
					bytes: new Uint8Array(ArkpackLimits.maxArkpackBytes + 1),
					provenance: {
						type: "community",
					},
					source: "user",
				}),
			),
		).rejects.toThrow("byte limit");
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
				version: "1.0",
				arkini: ArkiniAppVersion,
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
					bytes: Effect.runSync(
						encodeArkpackEnvelopeFx({
							payload: new Uint8Array(gzipSync(encoded)),
						}),
					),
					provenance: {
						type: "community",
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

		const result = await Effect.runPromise(
			Effect.result(
				readArkpackFx({
					bytes: Effect.runSync(
						encodeArkpackEnvelopeFx({
							payload: new Uint8Array(gzipSync(encoded)),
						}),
					),
					provenance: {
						type: "community",
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
