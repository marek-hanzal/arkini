import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect } from "effect";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createFilesystemLauncherPreferencesFx } from "~electron/main/launcher/createFilesystemLauncherPreferencesFx";

let root = "";
const preferenceDirectory = () => join(root, "arkini", "game", "preferences");
const currentPath = () => join(preferenceDirectory(), "launcher.last-package.json");

const createPreferences = () =>
	Effect.runPromise(
		createFilesystemLauncherPreferencesFx({
			root: preferenceDirectory(),
		}).pipe(Effect.provide(NodeServices.layer)),
	);

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "arkini-launcher-"));
});

afterEach(async () => {
	await rm(root, {
		recursive: true,
		force: true,
	});
});

describe("createFilesystemLauncherPreferencesFx", () => {
	it("round-trips one normalized package identity atomically", async () => {
		const preferences = await createPreferences();
		await Effect.runPromise(preferences.writeLastPackageIdFx("  package:test  "));
		expect(await readFile(currentPath(), "utf8")).toBe('"package:test"');
		expect(await Effect.runPromise(preferences.readLastPackageIdFx)).toBe("package:test");
	});
});
