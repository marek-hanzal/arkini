import { Effect } from "effect";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { installArkpackFileFx } from "~electron/main/arkpack/installArkpackFileFx";
import { createTestArkpack } from "~test/arkpack-support/fx/createTestArkpack";

let root = "";

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "arkini-install-"));
});

afterEach(async () => {
	await rm(root, {
		force: true,
		recursive: true,
	});
});

describe("installArkpackFileFx", () => {
	it("streams the first extraction and optimistically reuses its content-hash installation", async () => {
		const packageId = "package:installed";
		const arkpackPath = join(root, "source.arkpack");
		await writeFile(arkpackPath, createTestArkpack(undefined, packageId));
		const installationsRoot = join(root, "installed");

		const first = await Effect.runPromise(
			installArkpackFileFx({
				arkpackPath,
				expectedPackageId: packageId,
				installationsRoot,
			}),
		);
		expect(first.resources).toHaveLength(2);
		const resourcePath = first.resources[0]?.path;
		if (resourcePath === undefined) throw new Error("Expected an installed resource.");
		await writeFile(resourcePath, "locally changed");

		const second = await Effect.runPromise(
			installArkpackFileFx({
				arkpackPath,
				expectedPackageId: packageId,
				installationsRoot,
			}),
		);

		expect(second.contentHash).toBe(first.contentHash);
		expect(second.resources[0]?.path).toBe(resourcePath);
		expect(await readFile(resourcePath, "utf8")).toBe("locally changed");
	});
});
