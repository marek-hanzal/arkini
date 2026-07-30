import { NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createArkiniUserDataPathsFx } from "../../electron/main/user-data/createArkiniUserDataPathsFx";
import { migrateArkiniUserDataFx } from "../../electron/main/user-data/migrateArkiniUserDataFx";

let userDataPath = "";

beforeEach(async () => {
	userDataPath = await mkdtemp(join(tmpdir(), "arkini-user-data-"));
});

afterEach(async () => {
	await rm(userDataPath, {
		recursive: true,
		force: true,
	});
});

describe("Arkini user data", () => {
	it("normalizes game persistence below game and preserves destination conflicts", async () => {
		const paths = Effect.runSync(createArkiniUserDataPathsFx(userDataPath));
		expect(paths).toEqual({
			root: join(userDataPath, "arkini"),
			game: {
				root: join(userDataPath, "arkini", "game"),
				arkpacks: join(userDataPath, "arkini", "game", "arkpacks"),
				logs: join(userDataPath, "arkini", "game", "logs"),
				preferences: join(userDataPath, "arkini", "game", "preferences"),
				saves: join(userDataPath, "arkini", "game", "saves"),
			},
			editor: join(userDataPath, "arkini", "editor"),
			legacy: {
				arkpacks: join(userDataPath, "arkini", "arkpacks"),
				logs: join(userDataPath, "arkini", "logs"),
				preferences: join(userDataPath, "arkini", "preferences"),
				saves: join(userDataPath, "arkini", "saves"),
			},
		});

		const legacyConflictingSave = join(paths.legacy.saves, "arkini", "hash", "current.arksave");
		const canonicalConflictingSave = join(paths.game.saves, "arkini", "hash", "current.arksave");
		const legacyUniqueSave = join(paths.legacy.saves, "arkini", "other", "current.arksave");
		await mkdir(join(legacyConflictingSave, ".."), {
			recursive: true,
		});
		await mkdir(join(canonicalConflictingSave, ".."), {
			recursive: true,
		});
		await mkdir(join(legacyUniqueSave, ".."), {
			recursive: true,
		});
		await writeFile(legacyConflictingSave, "legacy", "utf8");
		await writeFile(canonicalConflictingSave, "canonical", "utf8");
		await writeFile(legacyUniqueSave, "unique", "utf8");
		await mkdir(paths.legacy.preferences, {
			recursive: true,
		});
		await writeFile(join(paths.legacy.preferences, "appearance.theme"), "dark", "utf8");

		await Effect.runPromise(
			migrateArkiniUserDataFx({
				paths,
			}).pipe(Effect.provide(NodeServices.layer)),
		);

		expect(await readFile(canonicalConflictingSave, "utf8")).toBe("canonical");
		expect(await readFile(legacyConflictingSave, "utf8")).toBe("legacy");
		expect(
			await readFile(join(paths.game.saves, "arkini", "other", "current.arksave"), "utf8"),
		).toBe("unique");
		expect(await readFile(join(paths.game.preferences, "appearance.theme"), "utf8")).toBe(
			"dark",
		);
		await expect(access(paths.editor)).resolves.toBeUndefined();
		await expect(access(paths.game.root)).resolves.toBeUndefined();
	});
});
