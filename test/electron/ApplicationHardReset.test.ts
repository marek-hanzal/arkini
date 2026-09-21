import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
	home: "",
	removalFailure: undefined as Error | undefined,
	relaunch: vi.fn(),
	exit: vi.fn(),
}));
vi.mock("electron", () => ({
	app: {
		relaunch: harness.relaunch,
		exit: harness.exit,
	},
}));
vi.mock("node:fs/promises", async (importOriginal) => {
	const original = await importOriginal<typeof import("node:fs/promises")>();
	return {
		...original,
		rm: (...args: Parameters<typeof original.rm>) =>
			harness.removalFailure ? Promise.reject(harness.removalFailure) : original.rm(...args),
	};
});
vi.mock("node:os", async (importOriginal) => {
	const original = await importOriginal<typeof import("node:os")>();
	return {
		...original,
		userInfo: () => ({
			homedir: harness.home,
		}),
	};
});

import { consumeApplicationHardResetFx } from "~electron/main/consumeApplicationHardResetFx";
import { requestApplicationHardResetFx } from "~electron/main/requestApplicationHardResetFx";

const originalArgv = process.argv;
afterEach(async () => {
	process.argv = originalArgv;
	harness.removalFailure = undefined;
	vi.clearAllMocks();
	if (harness.home)
		await rm(harness.home, {
			recursive: true,
			force: true,
		});
	harness.home = "";
});

describe("application hard reset", () => {
	it("removes only the canonical root on the next launch without following project symlinks", async () => {
		harness.home = await mkdtemp(join(tmpdir(), "serakki-reset-"));
		const root = join(harness.home, ".serakki");
		const external = join(harness.home, "external-project");
		await mkdir(join(root, "game", "saves"), {
			recursive: true,
		});
		await mkdir(external);
		await writeFile(join(root, "game", "saves", "manual.serasave"), "old save");
		await writeFile(join(external, "project.json"), "keep");
		await symlink(external, join(root, "linked-project"), "junction");
		process.argv = [
			"electron",
			"app.js",
			"--some-option",
		];

		await Effect.runPromise(requestApplicationHardResetFx);
		expect(harness.relaunch).toHaveBeenCalledWith({
			args: [
				"app.js",
				"--some-option",
				"--serakki-hard-reset",
			],
		});
		expect(harness.exit).toHaveBeenCalledWith(0);
		expect(await readFile(join(root, "game", "saves", "manual.serasave"), "utf8")).toBe(
			"old save",
		);

		process.argv.push("--serakki-hard-reset");
		await Effect.runPromise(consumeApplicationHardResetFx);
		expect(process.argv).toEqual([
			"electron",
			"app.js",
			"--some-option",
		]);
		await expect(readFile(join(root, "game", "saves", "manual.serasave"))).rejects.toThrow();
		expect(await readFile(join(external, "project.json"), "utf8")).toBe("keep");

		await mkdir(root);
		await writeFile(join(root, "new-save"), "keep new data");
		await Effect.runPromise(consumeApplicationHardResetFx);
		expect(await readFile(join(root, "new-save"), "utf8")).toBe("keep new data");
	});

	it("unlinks a symlinked data root without deleting its external target", async () => {
		harness.home = await mkdtemp(join(tmpdir(), "serakki-reset-"));
		const external = join(harness.home, "external");
		await mkdir(external);
		await writeFile(join(external, "keep"), "untouched");
		await symlink(external, join(harness.home, ".serakki"), "junction");
		process.argv = [
			"electron",
			"--serakki-hard-reset",
		];
		await Effect.runPromise(consumeApplicationHardResetFx);
		expect(await readFile(join(external, "keep"), "utf8")).toBe("untouched");
	});

	it("reports deletion failure and consumes the flag before a later ordinary launch", async () => {
		harness.home = await mkdtemp(join(tmpdir(), "serakki-reset-"));
		const root = join(harness.home, ".serakki");
		await mkdir(root);
		await writeFile(join(root, "save"), "keep");
		process.argv = [
			"electron",
			"--serakki-hard-reset",
		];
		harness.removalFailure = new Error("access denied");
		await expect(Effect.runPromise(consumeApplicationHardResetFx)).rejects.toThrow(
			"access denied",
		);
		expect(process.argv).toEqual([
			"electron",
		]);
		harness.removalFailure = undefined;
		await Effect.runPromise(consumeApplicationHardResetFx);
		expect(await readFile(join(root, "save"), "utf8")).toBe("keep");
	});

	it("does not exit if scheduling the restart fails", async () => {
		harness.relaunch.mockImplementationOnce(() => {
			throw new Error("cannot restart");
		});
		await expect(Effect.runPromise(requestApplicationHardResetFx)).rejects.toThrow(
			"cannot restart",
		);
		expect(harness.exit).not.toHaveBeenCalled();
	});
});
