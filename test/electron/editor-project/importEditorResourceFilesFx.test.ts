import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { importEditorResourceFilesFx } from "~electron/main/editor-project/importEditorResourceFilesFx";
import { createTestArkpack } from "~test/arkpack-support/fx/createTestArkpack";
import type { OwnedEditorProjectRepository } from "~/project-authoring/service/EditorProjectServiceOwnership";
import {
	createEditorProjectIpcRepository,
	editorProjectIpcProject,
} from "./ipc/support/createEditorProjectIpcRepository";

let root = "";

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "arkini-editor-artwork-"));
});

afterEach(async () => {
	await rm(root, {
		force: true,
		recursive: true,
	});
});

describe("importEditorResourceFilesFx", () => {
	it("accepts a non-square Image by native path while Artwork keeps its square contract", async () => {
		const imagePath = join(root, "hero.png");
		await sharp({
			create: {
				width: 3,
				height: 2,
				channels: 4,
				background: {
					r: 255,
					g: 0,
					b: 255,
					alpha: 1,
				},
			},
		})
			.png()
			.toFile(imagePath);
		const repository = createEditorProjectIpcRepository();

		await expect(
			Effect.runPromise(
				importEditorResourceFilesFx({
					repository,
					request: {
						files: [
							{
								name: "Hero.png",
								path: imagePath,
							},
						],
						projectId: "project-one",
						source: "files",
						type: "image",
					},
				}),
			),
		).resolves.toMatchObject({
			resourceIds: [
				"hero",
			],
		});
		expect(repository.upsertResourceFilesFx).toHaveBeenCalledWith({
			projectId: "project-one",
			resources: [
				expect.objectContaining({
					id: "hero",
					path: imagePath,
					type: "image",
				}),
			],
		});

		await expect(
			Effect.runPromise(
				importEditorResourceFilesFx({
					repository,
					request: {
						files: [
							{
								name: "Hero.png",
								path: imagePath,
							},
						],
						projectId: "project-one",
						source: "files",
						type: "artwork",
					},
				}),
			),
		).rejects.toMatchObject({
			message: expect.stringContaining("square PNG"),
		});
	});

	it("extracts an Arkpack to files that stay available through the repository write", async () => {
		const arkpackPath = join(root, "source.arkpack");
		await writeFile(arkpackPath, createTestArkpack());
		let extractedPaths: ReadonlyArray<string> = [];
		const base = createEditorProjectIpcRepository();
		const upsertResourceFilesFx = vi.fn<OwnedEditorProjectRepository["upsertResourceFilesFx"]>(
			(props) =>
				Effect.promise(async () => {
					extractedPaths = props.resources.map(({ path }) => path);
					await Promise.all(extractedPaths.map((path) => access(path)));
					return editorProjectIpcProject;
				}),
		);
		const repository = {
			...base,
			upsertResourceFilesFx,
		};

		const result = await Effect.runPromise(
			importEditorResourceFilesFx({
				repository,
				request: {
					files: [
						{
							name: "source.arkpack",
							path: arkpackPath,
						},
					],
					projectId: "project-one",
					source: "arkpack",
					type: "artwork",
				},
			}),
		);

		expect(result.resourceIds).toEqual([
			"asset-water",
		]);
		expect(upsertResourceFilesFx).toHaveBeenCalledOnce();
		for (const path of extractedPaths) await expect(access(path)).rejects.toBeDefined();
	});
});
