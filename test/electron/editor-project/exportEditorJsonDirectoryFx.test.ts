import * as NodeServices from "@effect/platform-node/NodeServices";
import type { BrowserWindow } from "electron";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect, it } from "@effect/vitest";
import { vi } from "vitest";

import { exportEditorJsonDirectoryFx } from "~electron/main/editor-project/exportEditorJsonDirectoryFx";
import {
	readReimportableProjectFx,
	writeReimportableProjectFx,
} from "./createEditorJsonExportDirectoryFx.test/harness";
import { createEditorProjectIpcRepository } from "./ipc/support/createEditorProjectIpcRepository";

const electron = vi.hoisted(() => ({
	showOpenDialog: vi.fn(),
}));

vi.mock("electron", () => ({
	dialog: {
		showOpenDialog: electron.showOpenDialog,
	},
}));

const window = {} as BrowserWindow;

describe("exportEditorJsonDirectoryFx", () => {
	it.effect("creates a new project folder inside the selected destination", () =>
		Effect.gen(function* () {
			const fileSystem = yield* FileSystem.FileSystem;
			const path = yield* Path.Path;
			const root = yield* fileSystem.makeTempDirectoryScoped();
			const source = `${root}/source`;
			const destination = `${root}/destination`;
			yield* fileSystem.makeDirectory(destination);
			yield* fileSystem.writeFileString(`${destination}/keep.txt`, "keep");
			yield* writeReimportableProjectFx(source, 1);
			const repository = createEditorProjectIpcRepository();
			vi.mocked(repository.readProjectRootFx).mockReturnValue(Effect.succeed(source));
			electron.showOpenDialog.mockResolvedValue({
				canceled: false,
				filePaths: [
					destination,
				],
			});

			const exported = yield* exportEditorJsonDirectoryFx({
				projectId: "project-one",
				repository,
				window,
			});

			expect(exported).not.toBeNull();
			if (exported === null) return;
			expect(path.dirname(exported.root)).toBe(yield* fileSystem.realPath(destination));
			expect(path.basename(exported.root)).toMatch(/^project-one-json-.+$/u);
			expect((yield* readReimportableProjectFx(exported.root)).marker.revision).toBe(1);
			expect(yield* fileSystem.readFileString(`${destination}/keep.txt`)).toBe("keep");
		}).pipe(Effect.provide(NodeServices.layer)),
	);

	it.effect("does not touch the repository or destination when selection is canceled", () =>
		Effect.gen(function* () {
			const fileSystem = yield* FileSystem.FileSystem;
			const destination = yield* fileSystem.makeTempDirectoryScoped();
			const repository = createEditorProjectIpcRepository();
			electron.showOpenDialog.mockResolvedValue({
				canceled: true,
				filePaths: [],
			});

			expect(
				yield* exportEditorJsonDirectoryFx({
					projectId: "project-one",
					repository,
					window,
				}),
			).toBeNull();
			expect(repository.readProjectRootFx).not.toHaveBeenCalled();
			expect(yield* fileSystem.readDirectory(destination)).toEqual([]);
		}).pipe(Effect.provide(NodeServices.layer)),
	);
});
