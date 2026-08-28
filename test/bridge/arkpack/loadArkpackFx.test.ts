import { Effect } from "effect";
import { beforeEach, describe, expect, it } from "vitest";

import type { ArkpackStorage } from "~/bridge/arkpack/ArkpackStorage";
import { loadArkpackFx } from "~/bridge/arkpack/loadArkpackFx";
import { createTestArkpack } from "~test/bridge/arkpack/support/createTestArkpack";
import { installTestPngDecoder } from "~test/bridge/arkpack/support/createTestPngBytes";
import { ArkiniAppVersion } from "../../../shared/ArkiniAppMetadata";
import { ArkiniVersionIncompatibleError } from "~/engine/version/ArkiniVersionAdmission";

beforeEach(installTestPngDecoder);

describe("loadArkpackFx", () => {
	it("surfaces an installed package's writer-major incompatibility", async () => {
		const currentMajor = ArkiniAppVersion.slice(0, ArkiniAppVersion.indexOf("."));
		const bytes = createTestArkpack(
			undefined,
			"package:future",
			"1.0",
			`${Number(currentMajor) + 1}.0.0`,
		);
		const storage: ArkpackStorage = {
			listFx: Effect.die("Unexpected catalog list."),
			readFx: () =>
				Effect.succeed([
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
				]),
			removeFx: () => Effect.void,
			writeFx: () => Effect.void,
			openUserDirectoryFx: Effect.void,
		};

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
		const storage: ArkpackStorage = {
			listFx: Effect.die("Unexpected catalog list."),
			readFx: (packageId) =>
				Effect.succeed(
					packageId === file.packageId
						? [
								file,
							]
						: [],
				),
			removeFx: () => Effect.void,
			writeFx: () => Effect.void,
			openUserDirectoryFx: Effect.void,
		};

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

	it("fails when the requested package is absent", async () => {
		const storage: ArkpackStorage = {
			listFx: Effect.die("Unexpected catalog list."),
			readFx: () => Effect.succeed([]),
			removeFx: () => Effect.void,
			writeFx: () => Effect.void,
			openUserDirectoryFx: Effect.void,
		};

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
		const storage: ArkpackStorage = {
			listFx: Effect.die("Unexpected catalog list."),
			readFx: () =>
				Effect.succeed([
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
				]),
			removeFx: () => Effect.void,
			writeFx: () => Effect.void,
			openUserDirectoryFx: Effect.void,
		};

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
