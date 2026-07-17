import { execFile } from "node:child_process";
import { copyFile, mkdir, mkdtemp, rm, stat, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const npmExecutable = process.platform === "win32" ? "npm.cmd" : "npm";

const copyTrackedWorkspace = async (target: string) => {
	const { stdout } = await execFileAsync(
		"git",
		[
			"ls-files",
			"-z",
		],
		{
			cwd: process.cwd(),
			encoding: "buffer",
			maxBuffer: 16 * 1024 * 1024,
		},
	);
	const trackedFiles = stdout
		.toString("utf8")
		.split("\0")
		.filter((path) => path.length > 0);

	for (const relativePath of trackedFiles) {
		const output = join(target, relativePath);
		await mkdir(dirname(output), {
			recursive: true,
		});
		await copyFile(resolve(relativePath), output);
	}

	await symlink(resolve("node_modules"), join(target, "node_modules"), "dir");
};

const runNpmScript = async (cwd: string, script: string) => {
	await execFileAsync(
		npmExecutable,
		[
			"run",
			script,
		],
		{
			cwd,
			env: process.env,
			maxBuffer: 32 * 1024 * 1024,
		},
	);
};

describe("fresh checkout desktop delivery inputs", () => {
	it("packs the ignored official Arkpack before dependency analysis consumes it", async () => {
		const workspace = await mkdtemp(join(tmpdir(), "arkini-clean-delivery-"));
		try {
			await copyTrackedWorkspace(workspace);
			await expect(stat(join(workspace, "game/arkini.game.arkpack"))).rejects.toMatchObject({
				code: "ENOENT",
			});

			await runNpmScript(workspace, "game:pack");
			const packed = await stat(join(workspace, "game/arkini.game.arkpack"));
			expect(packed.isFile()).toBe(true);
			await runNpmScript(workspace, "dc");
		} finally {
			await rm(workspace, {
				recursive: true,
				force: true,
			});
		}
	}, 120_000);
});
