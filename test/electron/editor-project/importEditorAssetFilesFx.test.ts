import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { importEditorAssetFilesFx } from "~electron/main/editor-project/importEditorAssetFilesFx";
import { createTestArkpack } from "~test/arkpack-support/fx/createTestArkpack";
import type { OwnedEditorProjectRepository } from "~/project-authoring/service/EditorProjectServiceOwnership";
import {
	createEditorProjectIpcRepository,
	editorProjectIpcProject,
} from "./ipc/support/createEditorProjectIpcRepository";

let root = "";

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "arkini-editor-assets-"));
});

afterEach(async () => {
	await rm(root, {
		force: true,
		recursive: true,
	});
});

describe("importEditorAssetFilesFx", () => {
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
			importEditorAssetFilesFx({
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
				},
			}),
		);

		expect(result.resourceIds).toEqual([
			"hero",
			"asset:water",
		]);
		expect(upsertResourceFilesFx).toHaveBeenCalledOnce();
		for (const path of extractedPaths) await expect(access(path)).rejects.toBeDefined();
	});
});
