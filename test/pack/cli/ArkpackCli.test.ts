import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { deriveArkpackPublicKey } from "~/engine/pack/cli/deriveArkpackPublicKey";

const execFileAsync = promisify(execFile);
let root = "";

const runCli = (environment: NodeJS.ProcessEnv, ...arguments_: ReadonlyArray<string>) =>
	execFileAsync(
		"node_modules/.bin/tsx",
		[
			"src/engine/cli/arkini.ts",
			"arkpack",
			...arguments_,
		],
		{
			env: {
				...process.env,
				...environment,
			},
		},
	);

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
	it("generates one protected dotenv key, signs, verifies, and rejects mutation", async () => {
		const environmentPath = join(root, ".env.local");
		const generated = await runCli({}, "keygen", "--output", environmentPath);
		expect(generated.stdout).not.toContain("BEGIN PRIVATE KEY");
		expect((await stat(environmentPath)).mode & 0o777).toBe(0o600);
		const assignment = await readFile(environmentPath, "utf8");
		const signKey = assignment.trim().slice("ARKINI_SIGN_KEY=".length);
		const publicKey = deriveArkpackPublicKey(signKey);
		const environment = {
			ARKINI_SIGN_KEY: signKey,
		};
		const arkpackPath = join(root, "fixture.arkpack");
		await writeFile(arkpackPath, new TextEncoder().encode("exact CLI fixture bytes"));

		await runCli(environment, "sign", arkpackPath);
		const verified = await runCli(
			environment,
			"verify",
			arkpackPath,
			"--public-key",
			publicKey,
		);
		expect(JSON.parse(verified.stdout.trim())).toMatchObject({
			trust: {
				type: "official",
			},
		});

		await writeFile(arkpackPath, new TextEncoder().encode("mutated CLI fixture bytes"));
		await expect(
			runCli(environment, "verify", arkpackPath, "--public-key", publicKey),
		).rejects.toMatchObject({
			code: 1,
		});
	}, 15_000);

	it("replaces only the signing assignment in an existing dotenv file", async () => {
		const environmentPath = join(root, ".env.local");
		await writeFile(
			environmentPath,
			"EDITOR_PORT=4123\nARKINI_SIGN_KEY=old-value\nFEATURE_FLAG=true\n",
		);

		await runCli({}, "keygen", "--output", environmentPath, "--force");

		const source = await readFile(environmentPath, "utf8");
		expect(source).toContain("EDITOR_PORT=4123\n");
		expect(source).toContain("FEATURE_FLAG=true\n");
		expect(source).not.toContain("ARKINI_SIGN_KEY=old-value");
		expect(source.match(/^ARKINI_SIGN_KEY=/gm)).toHaveLength(1);
	}, 15_000);
});
