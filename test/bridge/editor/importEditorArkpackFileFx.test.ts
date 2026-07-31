import { gzipSync } from "node:zlib";
import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

import type { EditorWorkspace } from "~/bridge/editor/EditorWorkspace";
import { importEditorArkpackFileFx } from "~/bridge/editor/importEditorArkpackFileFx";
import { encodeFx } from "~/engine/pack/fx/encodeFx";
import { editorTestPayload } from "~test/editor/support/editorTestPayload";

const createArkpackBytes = () =>
	new Uint8Array(gzipSync(Effect.runSync(encodeFx(editorTestPayload))));

const createWorkspace = (createFx: EditorWorkspace["createFx"]): EditorWorkspace => ({
	listFx: () => Effect.succeed([]),
	createFx,
	readFx: () => Effect.succeed(null),
	writeFx: () => Effect.die("Unexpected editor project write."),
	openDirectoryFx: () => Effect.void,
});

describe("importEditorArkpackFileFx", () => {
	it("validates and atomically delegates one manifest-backed expanded project record", async () => {
		const bytes = createArkpackBytes();
		const createFx = vi.fn(() => Effect.void);

		const descriptor = await Effect.runPromise(
			importEditorArkpackFileFx({
				file: {
					name: "editor-test.arkpack",
					size: bytes.byteLength,
					arrayBuffer: async () => bytes.slice().buffer,
				},
				workspace: createWorkspace(createFx),
			}),
		);

		expect(descriptor).toEqual(
			expect.objectContaining({
				projectId: "editor-test",
				title: "Editor test",
				game: "1.0",
			}),
		);
		expect(descriptor.createdAtMs).toBe(descriptor.updatedAtMs);
		expect(createFx).toHaveBeenCalledOnce();
		expect(createFx).toHaveBeenCalledWith(
			expect.objectContaining({
				projectId: "editor-test",
				files: expect.arrayContaining([
					expect.objectContaining({
						path: "editor.json",
					}),
					expect.objectContaining({
						path: "game.json",
					}),
					expect.objectContaining({
						path: "simple/water.json",
					}),
					expect.objectContaining({
						path: "resources/hero.png",
					}),
					expect.objectContaining({
						path: "assets/item-water.png",
					}),
				]),
			}),
		);
	});

	it("rejects dropped files without the arkpack extension before reading bytes", async () => {
		const arrayBuffer = vi.fn(async () => new ArrayBuffer(0));
		await expect(
			Effect.runPromise(
				importEditorArkpackFileFx({
					file: {
						name: "editor-test.zip",
						size: 0,
						arrayBuffer,
					},
					workspace: createWorkspace(() => Effect.void),
				}),
			),
		).rejects.toThrow("Choose a .arkpack file");
		expect(arrayBuffer).not.toHaveBeenCalled();
	});
});
