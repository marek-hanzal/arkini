import { execFile } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import {
	copyFile,
	mkdir,
	mkdtemp,
	readFile,
	readdir,
	rm,
	stat,
	symlink,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { ArkiniOfficialArkpackSigning } from "../../cli/arkpack/ArkiniOfficialArkpackSigning";
import { ArkpackTrustedKeysSchema } from "~/engine/pack/schema/ArkpackTrustedKeysSchema";

const execFileAsync = promisify(execFile);
const npmExecutable = process.platform === "win32" ? "npm.cmd" : "npm";

const copyTrackedWorkspace = async (target: string) => {
	const { stdout } = await execFileAsync(
		"git",
		[
			"ls-files",
			"--cached",
			"--others",
			"--exclude-standard",
			"-z",
		],
		{
			cwd: process.cwd(),
			encoding: "buffer",
			maxBuffer: 16 * 1024 * 1024,
		},
	);
	const workspaceFiles = stdout
		.toString("utf8")
		.split("\0")
		.filter((path) => path.length > 0);

	for (const relativePath of workspaceFiles) {
		try {
			await stat(resolve(relativePath));
		} catch (error) {
			if (
				typeof error === "object" &&
				error !== null &&
				"code" in error &&
				error.code === "ENOENT"
			) {
				continue;
			}
			throw error;
		}
		const output = join(target, relativePath);
		await mkdir(dirname(output), {
			recursive: true,
		});
		await copyFile(resolve(relativePath), output);
	}

	await symlink(resolve("node_modules"), join(target, "node_modules"), "dir");
};

const writeEphemeralOfficialSigningInputs = async (workspace: string) => {
	const pair = generateKeyPairSync("ed25519");
	const privateKey = pair.privateKey.export({
		format: "pem",
		type: "pkcs8",
	});
	const publicKey = pair.publicKey.export({
		format: "pem",
		type: "spki",
	});
	const privateKeyPath = join(workspace, ArkiniOfficialArkpackSigning.privateKeyPath);
	await mkdir(dirname(privateKeyPath), {
		recursive: true,
	});
	await writeFile(privateKeyPath, privateKey, {
		mode: 0o600,
	});

	const trustedKeysPath = join(workspace, ArkiniOfficialArkpackSigning.trustedKeysPath);
	const trustedKeys = ArkpackTrustedKeysSchema.parse(
		JSON.parse(await readFile(trustedKeysPath, "utf8")) as unknown,
	);
	let replaced = false;
	const keys = trustedKeys.keys.map((key) => {
		if (key.keyId !== ArkiniOfficialArkpackSigning.keyId) return key;
		replaced = true;
		return {
			...key,
			publicKey: publicKey.toString(),
		};
	});
	if (!replaced) throw new Error("Active test signing key is absent from its trusted registry.");
	await writeFile(
		trustedKeysPath,
		`${JSON.stringify(
			{
				...trustedKeys,
				keys,
			},
			undefined,
			"\t",
		)}\n`,
	);
};

const runNpmScript = async (
	cwd: string,
	script: string,
	environment: NodeJS.ProcessEnv = process.env,
) => {
	await execFileAsync(
		npmExecutable,
		[
			"run",
			script,
		],
		{
			cwd,
			env: environment,
			maxBuffer: 32 * 1024 * 1024,
		},
	);
};

describe("fresh checkout desktop delivery inputs", () => {
	it("builds from a clean checkout before dependency analysis consumes generated inputs", async () => {
		const workspace = await mkdtemp(join(tmpdir(), "arkini-clean-delivery-"));
		try {
			await copyTrackedWorkspace(workspace);
			await expect(stat(join(workspace, "game/arkini.game.arkpack"))).rejects.toMatchObject({
				code: "ENOENT",
			});
			await expect(stat(join(workspace, ".arkini"))).rejects.toMatchObject({
				code: "ENOENT",
			});
			await writeEphemeralOfficialSigningInputs(workspace);

			const environment = {
				...process.env,
			};
			delete environment.ARKINI_ARKPACK_PRIVATE_KEY;
			await runNpmScript(workspace, "build", environment);
			const packed = await stat(join(workspace, "game/arkini.game.arkpack"));
			expect(packed.isFile()).toBe(true);
			const signature = await stat(join(workspace, "game/arkini.game.arkpack.sig"));
			expect(signature.isFile()).toBe(true);
			const demo = await stat(join(workspace, "game/demo.game.arkpack"));
			expect(demo.isFile()).toBe(true);
			await expect(stat(join(workspace, "game/demo.game.arkpack.sig"))).rejects.toMatchObject(
				{
					code: "ENOENT",
				},
			);
			const renderer = await stat(join(workspace, "out/renderer/index.html"));
			expect(renderer.isFile()).toBe(true);
			expect(await readFile(join(workspace, "public/hero.png"))).toEqual(
				await readFile(join(workspace, "game/arkini/resources/hero.png")),
			);
			expect(await readFile(join(workspace, "out/renderer/hero.png"))).toEqual(
				await readFile(join(workspace, "public/hero.png")),
			);
			const rendererAssets = await readdir(join(workspace, "out/renderer/assets"), {
				recursive: true,
			});
			expect(rendererAssets.filter((path) => /^hero-.+[.]png$/.test(path))).toEqual([]);
			const emittedSignatures = rendererAssets.filter((path) => path.endsWith(".sig"));
			expect(emittedSignatures).toHaveLength(1);
			expect(
				await readFile(
					join(workspace, "out/renderer/assets", emittedSignatures[0] ?? ""),
					"utf8",
				),
			).toBe(await readFile(join(workspace, "game/arkini.game.arkpack.sig"), "utf8"));
			await runNpmScript(workspace, "dc");
		} finally {
			await rm(workspace, {
				recursive: true,
				force: true,
			});
		}
	}, 120_000);
});
