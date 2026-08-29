import { gzipSync } from "node:zlib";
import { Effect } from "effect";
import { beforeEach, describe, expect, it } from "vitest";

import type { ArkpackStorage } from "~/arkpack/renderer/ArkpackStorage";
import { loadArkpackFx } from "~/arkpack/renderer/loadArkpackFx";
import { encodeArkpackEnvelopeFx } from "~/arkpack/artifact/fx/encodeArkpackEnvelopeFx";
import { createTestArkpack } from "~test/arkpack/support/createTestArkpack";
import { installTestPngDecoder } from "~test/arkpack/support/createTestPngBytes";
import { ArkiniAppVersion } from "../../../shared/ArkiniAppMetadata";
import { ArkiniVersionIncompatibleError } from "~/engine/version/ArkiniVersionAdmission";

beforeEach(installTestPngDecoder);

const malformedArkpackBytes = Effect.runSync(
	encodeArkpackEnvelopeFx({
		payload: new Uint8Array(gzipSync(new Uint8Array())),
	}),
);

const createStorageFn = (files: ReadonlyArray<ArkpackStorage.File>): ArkpackStorage => ({
	listFx: Effect.die("Unexpected catalog list."),
	readFx: (packageId) => Effect.succeed(files.filter((file) => file.packageId === packageId)),
	removeFx: () => Effect.void,
	writeFx: () => Effect.void,
	openUserDirectoryFx: Effect.void,
});

describe("loadArkpackFx", () => {
	it("surfaces an installed package's writer-major incompatibility", async () => {
		const currentMajor = ArkiniAppVersion.slice(0, ArkiniAppVersion.indexOf("."));
		const bytes = createTestArkpack(
			undefined,
			"package:future",
			"1.0",
			`${Number(currentMajor) + 1}.0.0`,
		);
		const storage = createStorageFn([
			{
				packageId: "package:future",
				filename: "package%3Afuture.arkpack",
				bytes: bytes.buffer,
				provenance: {
					type: "community",
				},
				source: "user",
				overridesBundled: true,
			},
		]);

		await expect(
			Effect.runPromise(
				loadArkpackFx({
					packageId: "package:future",
					storage,
				}),
			),
		).rejects.toBeInstanceOf(ArkiniVersionIncompatibleError);
	});

	it("loads the exact effective file selected by package identity", async () => {
		const bytes = createTestArkpack(undefined, "package:selected");
		const file: ArkpackStorage.File = {
			packageId: "package:selected",
			filename: "package%3Aselected.arkpack",
			bytes: bytes.buffer,
			provenance: {
				type: "community",
			},
			source: "user",
			overridesBundled: true,
		};
		const storage = createStorageFn([
			file,
		]);

		const loaded = await Effect.runPromise(
			loadArkpackFx({
				packageId: "package:selected",
				storage,
			}),
		);

		expect(loaded.descriptor).toMatchObject({
			packageId: "package:selected",
			source: "user",
			overridesBundled: true,
		});
		expect(loaded.payload.config.meta.id).toBe("package:selected");
	});

	it("falls back from a malformed user override to the valid bundled package", async () => {
		const packageId = "package:fallback";
		const bundledBytes = createTestArkpack(undefined, packageId);
		const storage = createStorageFn([
			{
				packageId,
				filename: "package%3Afallback.arkpack",
				bytes: bundledBytes.buffer,
				provenance: {
					type: "official",
				},
				source: "bundled",
				overridesBundled: false,
			},
			{
				packageId,
				filename: "package%3Afallback.arkpack",
				bytes: malformedArkpackBytes.buffer,
				provenance: {
					type: "community",
				},
				source: "user",
				overridesBundled: true,
			},
		]);

		const loaded = await Effect.runPromise(
			loadArkpackFx({
				packageId,
				storage,
			}),
		);

		expect(loaded.descriptor).toMatchObject({
			packageId,
			source: "bundled",
			overridesBundled: false,
			provenance: {
				type: "official",
			},
		});
	});

	it("preserves bundled writer incompatibility after a malformed user override", async () => {
		const packageId = "package:future-fallback";
		const currentMajor = ArkiniAppVersion.slice(0, ArkiniAppVersion.indexOf("."));
		const bundledBytes = createTestArkpack(
			undefined,
			packageId,
			"1.0",
			`${Number(currentMajor) + 1}.0.0`,
		);
		const storage = createStorageFn([
			{
				packageId,
				filename: "package%3Afuture-fallback.arkpack",
				bytes: bundledBytes.buffer,
				provenance: {
					type: "official",
				},
				source: "bundled",
				overridesBundled: false,
			},
			{
				packageId,
				filename: "package%3Afuture-fallback.arkpack",
				bytes: malformedArkpackBytes.buffer,
				provenance: {
					type: "community",
				},
				source: "user",
				overridesBundled: true,
			},
		]);

		await expect(
			Effect.runPromise(
				loadArkpackFx({
					packageId,
					storage,
				}),
			),
		).rejects.toBeInstanceOf(ArkiniVersionIncompatibleError);
	});

	it("rejects an exact load when every candidate is malformed", async () => {
		const packageId = "package:invalid";
		const storage = createStorageFn([
			{
				packageId,
				filename: "package%3Ainvalid.arkpack",
				bytes: malformedArkpackBytes.buffer,
				provenance: {
					type: "community",
				},
				source: "user",
				overridesBundled: true,
			},
		]);

		await expect(
			Effect.runPromise(
				loadArkpackFx({
					packageId,
					storage,
				}),
			),
		).rejects.toThrow(`Arkpack ${packageId} is not installed.`);
	});

	it("fails when the requested package is absent", async () => {
		const storage = createStorageFn([]);

		await expect(
			Effect.runPromise(
				loadArkpackFx({
					packageId: "missing",
					storage,
				}),
			),
		).rejects.toThrow("Arkpack missing is not installed");
	});

	it("plays a Community user override without treating provenance as admission", async () => {
		const bundledBytes = createTestArkpack(undefined, "package:tampered");
		const userBytes = createTestArkpack(undefined, "package:tampered");
		const storage = createStorageFn([
			{
				packageId: "package:tampered",
				filename: "package%3Atampered.arkpack",
				bytes: bundledBytes.buffer,
				provenance: {
					type: "official",
				},
				source: "bundled",
				overridesBundled: false,
			},
			{
				packageId: "package:tampered",
				filename: "package%3Atampered.arkpack",
				bytes: userBytes.buffer,
				provenance: {
					type: "community",
				},
				source: "user",
				overridesBundled: true,
			},
		]);

		const loaded = await Effect.runPromise(
			loadArkpackFx({
				packageId: "package:tampered",
				storage,
			}),
		);
		expect(loaded.descriptor).toMatchObject({
			source: "user",
			provenance: {
				type: "community",
			},
		});
	});
});
