import * as NodeServices from "@effect/platform-node/NodeServices";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ArkiniAppVersion } from "../../../../shared/ArkiniAppMetadata";
import { createEditorProjectFilesystemPathsFx } from "../../../../electron/main/editor-project/filesystem/createEditorProjectFilesystemPathsFx";
import { readFilesystemEditorProjectVersionHistoryFx } from "../../../../electron/main/editor-project/filesystem/fx/readFilesystemEditorProjectVersionHistoryFx";

let root = "";
const writerMajor = ArkiniAppVersion.slice(0, ArkiniAppVersion.indexOf("."));

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "arkini-version-history-"));
});

afterEach(async () => {
	await rm(root, {
		force: true,
		recursive: true,
	});
});

describe("readFilesystemEditorProjectVersionHistoryFx", () => {
	it("admits same-major writer provenance before enforcing the history graph", async () => {
		const paths = await Effect.runPromise(
			createEditorProjectFilesystemPathsFx(root).pipe(Effect.provide(NodeServices.layer)),
		);
		const versionId = "child";
		const versionDirectory = await Effect.runPromise(
			paths.versionDirectoryFx(versionId).pipe(Effect.provide(NodeServices.layer)),
		);
		const hash = "0".repeat(64);
		await mkdir(versionDirectory, {
			recursive: true,
		});
		await Promise.all([
			writeFile(
				paths.versionHeadFile,
				JSON.stringify({
					current: versionId,
					versions: [
						versionId,
					],
				}),
			),
			writeFile(
				await Effect.runPromise(
					paths
						.versionDescriptorFileFx(versionId)
						.pipe(Effect.provide(NodeServices.layer)),
				),
				JSON.stringify({
					parentVersionId: "missing-parent",
					subject: "Child",
					arkini: `${writerMajor}.999.999`,
					version: "1.0",
					sourceRevision: 1,
					contentFingerprint: hash,
					createdAtMs: 1,
				}),
			),
			writeFile(
				await Effect.runPromise(
					paths.versionManifestFileFx(versionId).pipe(Effect.provide(NodeServices.layer)),
				),
				JSON.stringify({
					game: hash,
					items: {},
					assets: {},
					resources: {},
					scenarios: {},
				}),
			),
		]);

		await expect(
			Effect.runPromise(
				readFilesystemEditorProjectVersionHistoryFx(paths).pipe(
					Effect.provide(NodeServices.layer),
				),
			),
		).rejects.toThrow("references missing parent missing-parent");
	});
});
