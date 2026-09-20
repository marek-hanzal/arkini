import { Effect } from "effect";
import { mkdtemp, readFile, rm, writeFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { installSerapackFileFx } from "~electron/main/serapack/installSerapackFileFx";
import {
	createTestSerapack,
	testSerapackConfig,
} from "~test/serapack-support/fx/createTestSerapack";
import {
	encodeTestSerapackEnvelopeFx,
	encodeTestSerapackPayloadFx,
} from "~test/serapack-support/fx/testSerapackCodecFx";
import { createTestPngBytes } from "~test/serapack-support/fn/createTestPngBytes";
import { createTestOggOpusBytesFn } from "~test/game-config-resource/support/createTestOggOpusBytesFn";
import { SerakkiAppVersion } from "~shared/SerakkiAppMetadata";
import { readSerapackFileLayoutFx } from "~/serapack-artifact/fx/readSerapackFileLayoutFx";

let root = "";

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "serakki-install-"));
});

afterEach(async () => {
	await rm(root, {
		force: true,
		recursive: true,
	});
});

describe("installSerapackFileFx", () => {
	it.each([
		".",
		"..",
	])("keeps package %s inside its encoded installation directory", async (packageId) => {
		const serapackPath = join(root, "source.serapack");
		const installationsRoot = join(root, "installed");
		await writeFile(serapackPath, createTestSerapack(undefined, packageId));
		const installed = await Effect.runPromise(
			installSerapackFileFx({
				serapackPath,
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
		const serapackPath = join(root, "corrupt.serapack");
		const bytes = createTestSerapack();
		await writeFile(serapackPath, bytes);
		const layout = await Effect.runPromise(readSerapackFileLayoutFx(serapackPath));
		// Keep the PNG header intact and corrupt the first compressed image byte.
		bytes[layout.resources[0]!.offset + 41] = 0;
		await writeFile(serapackPath, bytes);
		const damaged = await Effect.runPromise(readSerapackFileLayoutFx(serapackPath));
		const installationsRoot = join(root, "installed");
		await expect(
			Effect.runPromise(
				installSerapackFileFx({
					serapackPath,
					expectedPackageId: testSerapackConfig.meta.id,
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
		const serapackPath = join(root, "source.serapack");
		await writeFile(serapackPath, createTestSerapack(undefined, packageId));
		const installationsRoot = join(root, "installed");

		const first = await Effect.runPromise(
			installSerapackFileFx({
				serapackPath,
				expectedPackageId: packageId,
				installationsRoot,
			}),
		);
		expect(first.resources).toHaveLength(2);
		const resourcePath = first.resources[0]?.path;
		if (resourcePath === undefined) throw new Error("Expected an installed resource.");
		await writeFile(resourcePath, "locally changed");

		const second = await Effect.runPromise(
			installSerapackFileFx({
				serapackPath,
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
			encodeTestSerapackPayloadFx({
				version: "1.0",
				serakki: SerakkiAppVersion,
				config: {
					...testSerapackConfig,
					meta: {
						...testSerapackConfig.meta,
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
		const serapackPath = join(root, "audio.serapack");
		await writeFile(
			serapackPath,
			Effect.runSync(
				encodeTestSerapackEnvelopeFx({
					payload,
				}),
			),
		);

		const installed = await Effect.runPromise(
			installSerapackFileFx({
				serapackPath,
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
