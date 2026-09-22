import { type BrowserWindow, dialog } from "electron";
import { Effect } from "effect";
import { zip, type AsyncZippable } from "fflate";
import { randomUUID } from "node:crypto";
import { rename, rm, writeFile } from "node:fs/promises";
import { arch, release } from "node:os";
import { basename, dirname, join } from "node:path";

import type { DiagnosticLog } from "~electron/main/diagnostics/createDiagnosticLogFx";
import { SerakkiAppVersion } from "~shared/SerakkiAppMetadata";
import { encodeGameProjectFileStemFn } from "~/game-config-source/fn/encodeGameProjectFileStemFn";
import type { FilesystemGameSaveFiles } from "~/game-persistence/fx/createFilesystemGameSaveFilesFx";

export namespace exportDiagnosticsBundleFx {
	export interface Display {
		readonly width: number;
		readonly height: number;
		readonly scaleFactor: number;
	}

	export interface Props {
		readonly diagnostics: DiagnosticLog;
		readonly display: Display;
		readonly saves: FilesystemGameSaveFiles;
		readonly window: BrowserWindow;
	}
}

const encoder = new TextEncoder();

const zipFilesFx = (files: AsyncZippable) =>
	Effect.tryPromise({
		try: () =>
			new Promise<Uint8Array>((resolveFn, rejectFn) => {
				zip(
					files,
					{
						level: 6,
					},
					(error, bytes) => {
						if (error !== null) rejectFn(error);
						else resolveFn(bytes);
					},
				);
			}),
		catch: (cause) => cause,
	});

/** Zips the already support-safe diagnostics plus saves for the last Official game. */
export const exportDiagnosticsBundleFx = Effect.fn("exportDiagnosticsBundleFx")(
	({ diagnostics, display, saves, window }: exportDiagnosticsBundleFx.Props) =>
		Effect.gen(function* () {
			const exportedAt = new Date();
			const selection = yield* Effect.promise(() =>
				dialog.showSaveDialog(window, {
					title: "Save diagnostics",
					buttonLabel: "Save diagnostics",
					defaultPath: `serakki-diagnostics-${exportedAt.toISOString().slice(0, 10)}.zip`,
					filters: [
						{
							name: "ZIP archive",
							extensions: [
								"zip",
							],
						},
					],
				}),
			);
			if (selection.canceled || selection.filePath === undefined) return false;

			const [lastGame, diagnosticFiles] = yield* Effect.all(
				[
					diagnostics.readLastGameFx,
					diagnostics.snapshotFx,
				] as const,
				{
					concurrency: "unbounded",
				},
			);
			const archive: AsyncZippable = Object.fromEntries(
				diagnosticFiles.map((file) => [
					`diagnostics/${file.name}`,
					file.bytes,
				]),
			);
			const saveFiles: Array<{
				readonly path: string;
				readonly savedAt: string;
				readonly slot: string;
			}> = [];
			if (lastGame?.provenance === "official") {
				const directory = encodeGameProjectFileStemFn(lastGame.packageId);
				for (const save of yield* saves.snapshotFx({
					packageId: lastGame.packageId,
				})) {
					const path = `saves/${directory}/${save.slot}.serasave`;
					archive[path] = save.bytes;
					saveFiles.push({
						path,
						savedAt: new Date(save.savedAt).toISOString(),
						slot: save.slot,
					});
				}
			}
			const manifest = {
				exportedAt: exportedAt.toISOString(),
				applicationVersion: SerakkiAppVersion,
				system: {
					platform: process.platform,
					architecture: arch(),
					release: release(),
					display,
				},
				lastPlayed: lastGame,
				saves: saveFiles,
				serapackBytesIncluded: false,
				files: [
					...Object.keys(archive),
					"manifest.json",
				].sort(),
			};
			archive["manifest.json"] = encoder.encode(`${JSON.stringify(manifest, null, 2)}\n`);

			const bytes = yield* zipFilesFx(archive);
			const target = selection.filePath;
			const pending = join(dirname(target), `.${basename(target)}.${randomUUID()}.pending`);
			yield* Effect.tryPromise({
				try: async () => {
					try {
						await writeFile(pending, bytes);
						await rename(pending, target);
					} finally {
						await rm(pending, {
							force: true,
						});
					}
				},
				catch: (cause) => cause,
			});
			return true;
		}),
);
