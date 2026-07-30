import { gzipSync } from "node:zlib";
import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

import type { EditorWorkspace } from "~/bridge/editor/EditorWorkspace";
import { importEditorArkpackFileFx } from "~/bridge/editor/importEditorArkpackFileFx";
import { encodeFx } from "~/engine/pack/fx/encodeFx";
import { editorTestPayload } from "~test/editor/support/editorTestPayload";

const createArkpackBytes = () =>
	new Uint8Array(gzipSync(Effect.runSync(encodeFx(editorTestPayload))));

describe("importEditorArkpackFileFx", () => {
	it("validates and atomically delegates one expanded project record", async () => {
		const bytes = createArkpackBytes();
		const createFx = vi.fn(() => Effect.void);
		const workspace: EditorWorkspace = {
			createFx,
			readFx: () => Effect.succeed(null),
			openDirectoryFx: () => Effect.void,
		};

		const descriptor = await Effect.runPromise(
			importEditorArkpackFileFx({
				file: {
					name: "editor-test.arkpack",
					size: bytes.byteLength,
					arrayBuffer: async () => bytes.slice().buffer,
				},
				workspace,
			}),
		);

		expect(descriptor).toEqual({
			projectId: "editor-test",
			title: "Editor test",
			version: "1.0",
		});
		expect(createFx).toHaveBeenCalledOnce();
		expect(createFx).toHaveBeenCalledWith(
			expect.objectContaining({
				projectId: "editor-test",
				files: expect.arrayContaining([
					expect.objectContaining({ path: "game.json" }),
					expect.objectContaining({ path: "simple/water.json" }),
					expect.objectContaining({ path: "resources/hero.png" }),
					expect.objectContaining({ path: "assets/item-water.png" }),
				]),
			}),
		);
	});
});
