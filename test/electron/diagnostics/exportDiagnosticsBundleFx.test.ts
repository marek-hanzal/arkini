import { Effect } from "effect";
import { unzipSync } from "fflate";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BrowserWindow } from "electron";

const electron = vi.hoisted(() => ({
	showSaveDialog: vi.fn(),
}));

vi.mock("electron", () => ({
	dialog: {
		showSaveDialog: electron.showSaveDialog,
	},
}));

import { exportDiagnosticsBundleFx } from "~electron/main/diagnostics/exportDiagnosticsBundleFx";
import type { DiagnosticLog } from "~electron/main/diagnostics/createDiagnosticLogFx";
import type { FilesystemGameSaveFiles } from "~/game-persistence/fx/createFilesystemGameSaveFilesFx";

const temporaryDirectories: string[] = [];

afterEach(async () => {
	for (const directory of temporaryDirectories.splice(0))
		await rm(directory, {
			recursive: true,
			force: true,
		});
	vi.clearAllMocks();
});

describe("exportDiagnosticsBundleFx", () => {
	it("zips support-ready logs and the last Official game's saves without a Serapack", async () => {
		const root = await mkdtemp(join(tmpdir(), "serakki-support-export-"));
		temporaryDirectories.push(root);
		const target = join(root, "support.zip");
		electron.showSaveDialog.mockResolvedValue({
			canceled: false,
			filePath: target,
		});
		const snapshotSave = vi.fn(() =>
			Effect.succeed([
				{
					slot: "current" as const,
					savedAt: 1,
					bytes: new Uint8Array([
						7,
						8,
					]),
				},
			]),
		);
		const saves = {
			readFx: () => Effect.succeed(null),
			writeFx: () => Effect.void,
			clearFx: () => Effect.void,
			listFx: () => Effect.succeed([]),
			restoreFx: () => Effect.void,
			snapshotFx: snapshotSave,
		} satisfies FilesystemGameSaveFiles;
		const diagnostics = {
			readLastGameFx: Effect.succeed({
				provenance: "official",
				packageId: "official-game",
				contentHash: "a".repeat(64),
				version: "1.0.0",
				serakki: "0.5.1",
			}),
			snapshotFx: Effect.succeed([
				{
					name: "support.md",
					bytes: new TextEncoder().encode("support-ready log"),
				},
			]),
		} as unknown as DiagnosticLog;

		await expect(
			Effect.runPromise(
				exportDiagnosticsBundleFx({
					diagnostics,
					display: {
						width: 1920,
						height: 1080,
						scaleFactor: 2,
					},
					saves,
					window: {} as BrowserWindow,
				}),
			),
		).resolves.toBe(true);

		const archive = unzipSync(new Uint8Array(await readFile(target)));
		expect(Object.keys(archive).sort()).toEqual([
			"diagnostics/support.md",
			"manifest.json",
			"saves/official-game/current.serasave",
		]);
		expect(Object.keys(archive).some((name) => name.endsWith(".serapack"))).toBe(false);
		expect(snapshotSave).toHaveBeenCalledWith({
			packageId: "official-game",
		});
		const manifest = JSON.parse(new TextDecoder().decode(archive["manifest.json"])) as {
			readonly lastPlayed: unknown;
			readonly saves: ReadonlyArray<unknown>;
			readonly serapackBytesIncluded: boolean;
		};
		expect(manifest.lastPlayed).toMatchObject({
			provenance: "official",
		});
		expect(manifest.saves).toEqual([
			{
				path: "saves/official-game/current.serasave",
				savedAt: new Date(1).toISOString(),
				slot: "current",
			},
		]);
		expect(manifest.serapackBytesIncluded).toBe(false);
	});

	it("does not read saves for a Community game", async () => {
		const root = await mkdtemp(join(tmpdir(), "serakki-support-export-"));
		temporaryDirectories.push(root);
		electron.showSaveDialog.mockResolvedValue({
			canceled: false,
			filePath: join(root, "community.zip"),
		});
		const snapshotSave = vi.fn(() => Effect.die("community save requested"));
		await Effect.runPromise(
			exportDiagnosticsBundleFx({
				diagnostics: {
					readLastGameFx: Effect.succeed({
						provenance: "community",
					}),
					snapshotFx: Effect.succeed([]),
				} as unknown as DiagnosticLog,
				display: {
					width: 1,
					height: 1,
					scaleFactor: 1,
				},
				saves: {
					snapshotFx: snapshotSave,
				} as unknown as FilesystemGameSaveFiles,
				window: {} as BrowserWindow,
			}),
		);
		expect(snapshotSave).not.toHaveBeenCalled();
	});

	it("does not read or write anything after the native dialog is canceled", async () => {
		electron.showSaveDialog.mockResolvedValue({
			canceled: true,
		});
		const readLastGameFx = vi.fn(() => Effect.succeed(null));
		const snapshotFx = vi.fn(() => Effect.succeed([]));

		await expect(
			Effect.runPromise(
				exportDiagnosticsBundleFx({
					diagnostics: {
						readLastGameFx: Effect.suspend(readLastGameFx),
						snapshotFx: Effect.suspend(snapshotFx),
					} as unknown as DiagnosticLog,
					display: {
						width: 1,
						height: 1,
						scaleFactor: 1,
					},
					saves: {} as FilesystemGameSaveFiles,
					window: {} as BrowserWindow,
				}),
			),
		).resolves.toBe(false);
		expect(readLastGameFx).not.toHaveBeenCalled();
		expect(snapshotFx).not.toHaveBeenCalled();
	});
});
