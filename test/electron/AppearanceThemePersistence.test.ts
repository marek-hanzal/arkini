import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readAppearanceThemeFx } from "../../electron/main/appearance/readAppearanceThemeFx";
import { writeAppearanceThemeFx } from "../../electron/main/appearance/writeAppearanceThemeFx";

let root = "";
const preferenceDirectory = () => join(root, "arkini", "preferences");
const currentPath = () => join(preferenceDirectory(), "appearance.theme");
const pendingPath = () => join(preferenceDirectory(), "appearance.pending");

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "arkini-appearance-"));
});

afterEach(async () => {
	await rm(root, {
		recursive: true,
		force: true,
	});
});

describe("appearance theme persistence", () => {
	it("defaults missing or malformed preference data to dark", async () => {
		expect(
			await Effect.runPromise(
				readAppearanceThemeFx({
					userDataPath: root,
				}),
			),
		).toBe("dark");

		await mkdir(preferenceDirectory(), {
			recursive: true,
		});
		await writeFile(currentPath(), "sepia", "utf8");

		expect(
			await Effect.runPromise(
				readAppearanceThemeFx({
					userDataPath: root,
				}),
			),
		).toBe("dark");
	});

	it("round-trips every explicit preference including system", async () => {
		for (const theme of [
			"dark",
			"light",
			"system",
		] as const) {
			await Effect.runPromise(
				writeAppearanceThemeFx({
					userDataPath: root,
					theme,
				}),
			);
			expect(await readFile(currentPath(), "utf8")).toBe(theme);
			expect(
				await Effect.runPromise(
					readAppearanceThemeFx({
						userDataPath: root,
					}),
				),
			).toBe(theme);
			await expect(access(pendingPath())).rejects.toBeDefined();
		}
	});

	it("rejects unsupported values instead of persisting them", async () => {
		await expect(
			Effect.runPromise(
				writeAppearanceThemeFx({
					userDataPath: root,
					theme: "sepia" as never,
				}),
			),
		).rejects.toThrow("Electron main operation failed: persist the appearance preference");
		await expect(access(currentPath())).rejects.toBeDefined();
	});
});
