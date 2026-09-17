import { Effect } from "effect";
import { mkdtemp, readFile, rm, writeFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { installArkpackFileFx } from "~electron/main/arkpack/installArkpackFileFx";
import { createTestArkpack, testArkpackConfig } from "~test/arkpack-support/fx/createTestArkpack";
import {
	encodeTestArkpackEnvelopeFx,
	encodeTestArkpackPayloadFx,
} from "~test/arkpack-support/fx/testArkpackCodecFx";
import { createTestPngBytes } from "~test/arkpack-support/fn/createTestPngBytes";
import { createTestOggOpusBytesFn } from "~test/game-config-resource/support/createTestOggOpusBytesFn";
import { ArkiniAppVersion } from "~shared/ArkiniAppMetadata";
import { readArkpackFileLayoutFx } from "~/arkpack-artifact/fx/readArkpackFileLayoutFx";

let root = "";

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "arkini-install-"));
});

afterEach(async () => {
	await rm(root, {
		force: true,
		recursive: true,
	});
});

describe("installArkpackFileFx", () => {
	it.each([
		".",
		"..",
	])("keeps package %s inside its encoded installation directory", async (packageId) => {
		const arkpackPath = join(root, "source.arkpack");
		const installationsRoot = join(root, "installed");
		await writeFile(arkpackPath, createTestArkpack(undefined, packageId));
		const installed = await Effect.runPromise(
			installArkpackFileFx({
				arkpackPath,
				expectedPackageId: packageId,
				installationsRoot,
			}),
		);
		expect(installed.resources[0]?.path).toBe(
			join(
				installationsRoot,
				packageId === "." ? "%2E" : "%2E%2E",
				installed.contentHash,
				"resources",
				"000000",
			),
		);
	});

	it("rejects a PNG with valid metadata but corrupt pixels before publishing an installation", async () => {
		const arkpackPath = join(root, "corrupt.arkpack");
		const bytes = createTestArkpack();
		await writeFile(arkpackPath, bytes);
		const layout = await Effect.runPromise(readArkpackFileLayoutFx(arkpackPath));
		// Keep the PNG header intact and corrupt the first compressed image byte.
		bytes[layout.resources[0]!.offset + 41] = 0;
		await writeFile(arkpackPath, bytes);
		const damaged = await Effect.runPromise(readArkpackFileLayoutFx(arkpackPath));
		const installationsRoot = join(root, "installed");
		await expect(
			Effect.runPromise(
				installArkpackFileFx({
					arkpackPath,
					expectedPackageId: testArkpackConfig.meta.id,
					installationsRoot,
				}),
			),
		).rejects.toThrow("must decode as a valid PNG");
		await expect(
			access(join(installationsRoot, "game%3Atest", damaged.contentHash)),
		).rejects.toBeDefined();
	});

	it("streams the first extraction and optimistically reuses its content-hash installation", async () => {
		const packageId = "package:installed";
		const arkpackPath = join(root, "source.arkpack");
		await writeFile(arkpackPath, createTestArkpack(undefined, packageId));
		const installationsRoot = join(root, "installed");

		const first = await Effect.runPromise(
			installArkpackFileFx({
				arkpackPath,
				expectedPackageId: packageId,
				installationsRoot,
			}),
		);
		expect(first.resources).toHaveLength(2);
		const resourcePath = first.resources[0]?.path;
		if (resourcePath === undefined) throw new Error("Expected an installed resource.");
		await writeFile(resourcePath, "locally changed");

		const second = await Effect.runPromise(
			installArkpackFileFx({
				arkpackPath,
				expectedPackageId: packageId,
				installationsRoot,
			}),
		);

		expect(second.contentHash).toBe(first.contentHash);
		expect(second.resources[0]?.path).toBe(resourcePath);
		expect(await readFile(resourcePath, "utf8")).toBe("locally changed");
	});

	it("installs image, Music, and SFX resources through their native validators", async () => {
		const packageId = "package:audio";
		const payload = Effect.runSync(
			encodeTestArkpackPayloadFx({
				version: "1.0",
				arkini: ArkiniAppVersion,
				config: {
					...testArkpackConfig,
					meta: {
						...testArkpackConfig.meta,
						id: packageId,
					},
				},
				resources: [
					{
						id: "hero",
						type: "image",
						bytes: createTestPngBytes(),
					},
					{
						id: "asset-water",
						type: "artwork",
						bytes: createTestPngBytes(),
					},
					{
						id: "theme",
						type: "music",
						bytes: createTestOggOpusBytesFn(),
					},
					{
						id: "job-start",
						type: "sfx",
						bytes: createTestOggOpusBytesFn(),
					},
				],
			}),
		);
		const arkpackPath = join(root, "audio.arkpack");
		await writeFile(
			arkpackPath,
			Effect.runSync(
				encodeTestArkpackEnvelopeFx({
					payload,
				}),
			),
		);

		const installed = await Effect.runPromise(
			installArkpackFileFx({
				arkpackPath,
				expectedPackageId: packageId,
				installationsRoot: join(root, "installed"),
			}),
		);

		expect(
			installed.resources.map(({ id, type }) => ({
				id,
				type,
			})),
		).toEqual([
			{
				id: "hero",
				type: "image",
			},
			{
				id: "asset-water",
				type: "artwork",
			},
			{
				id: "theme",
				type: "music",
			},
			{
				id: "job-start",
				type: "sfx",
			},
		]);
	});
});
