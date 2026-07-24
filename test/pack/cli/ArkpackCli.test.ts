import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const keyId = "test-cli-2026-01";
let root = "";

const runCli = (...arguments_: ReadonlyArray<string>) =>
	execFileAsync("node_modules/.bin/tsx", [
		"cli/arkini.ts",
		"arkpack",
		...arguments_,
	]);

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "arkini-signing-cli-"));
});

afterEach(async () => {
	await rm(root, {
		force: true,
		recursive: true,
	});
});

describe("Arkpack signing CLI", () => {
	it("generates protected keys, signs, verifies, and exits non-zero after mutation", async () => {
		const privateKeyPath = join(root, "private.pem");
		const publicKeyPath = join(root, "public.pem");
		const generated = await runCli(
			"keygen",
			"--private-key-output",
			privateKeyPath,
			"--public-key-output",
			publicKeyPath,
		);
		expect(generated.stdout).not.toContain("BEGIN PRIVATE KEY");
		expect((await stat(privateKeyPath)).mode & 0o777).toBe(0o600);
		const publicKey = await readFile(publicKeyPath, "utf8");
		const registryPath = join(root, "keys.json");
		await writeFile(
			registryPath,
			`${JSON.stringify(
				{
					formatVersion: 1,
					keys: [
						{
							algorithm: "ed25519",
							keyId,
							publicKey,
						},
					],
				},
				undefined,
				"\t",
			)}\n`,
		);
		const arkpackPath = join(root, "fixture.arkpack");
		await writeFile(arkpackPath, new TextEncoder().encode("exact CLI fixture bytes"));

		await runCli("sign", arkpackPath, "--key-id", keyId, "--private-key", privateKeyPath);
		const verified = await runCli("verify", arkpackPath, "--trusted-keys", registryPath);
		expect(JSON.parse(verified.stdout.trim())).toMatchObject({
			trust: {
				type: "official",
				keyId,
			},
		});

		await writeFile(arkpackPath, new TextEncoder().encode("mutated CLI fixture bytes"));
		await expect(
			runCli("verify", arkpackPath, "--trusted-keys", registryPath),
		).rejects.toMatchObject({
			code: 1,
		});
		await expect(
			runCli(
				"keygen",
				"--private-key-output",
				privateKeyPath,
				"--public-key-output",
				publicKeyPath,
			),
		).rejects.toMatchObject({
			code: 1,
		});
	});
});
