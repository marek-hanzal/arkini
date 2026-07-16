import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import packageJson from "../../package.json" with { type: "json" };
import { afterEach, describe, expect, it } from "vitest";
import { createDesktopChecksumsFx } from "../../cli/desktop/createDesktopChecksumsFx";
import { verifyDesktopArtifactsFx } from "../../cli/desktop/verifyDesktopArtifactsFx";

const temporaryDirectories: string[] = [];

const createReleaseFixture = async () => {
	const directory = await mkdtemp(join(tmpdir(), "arkini-desktop-release-"));
	temporaryDirectories.push(directory);
	const artifacts = [
		`Arkini-${packageJson.version}-mac-arm64.dmg`,
		`Arkini-${packageJson.version}-mac-arm64.zip`,
	] as const;
	for (const artifact of artifacts) {
		await writeFile(join(directory, artifact), `fixture:${artifact}`);
	}
	const resources = join(directory, "mac-arm64", "Arkini.app", "Contents", "Resources");
	await mkdir(resources, {
		recursive: true,
	});
	await writeFile(join(resources, "app.asar"), "fixture asar");
	return {
		directory,
		artifacts,
	};
};

afterEach(async () => {
	await Promise.all(
		temporaryDirectories.splice(0).map((directory) =>
			rm(directory, {
				recursive: true,
				force: true,
			}),
		),
	);
});

describe("desktop packaging artifacts", () => {
	it("writes deterministic SHA-256 entries and verifies the packaged app seam", async () => {
		const fixture = await createReleaseFixture();
		await createDesktopChecksumsFx(fixture.directory);
		await expect(verifyDesktopArtifactsFx(fixture.directory)).resolves.toBeUndefined();

		const checksumText = await readFile(join(fixture.directory, "SHA256SUMS"), "utf8");
		for (const artifact of fixture.artifacts) {
			const expected = createHash("sha256")
				.update(await readFile(join(fixture.directory, artifact)))
				.digest("hex");
			expect(checksumText).toContain(`${expected}  ${artifact}`);
		}
	});

	it("rejects a modified artifact", async () => {
		const fixture = await createReleaseFixture();
		await createDesktopChecksumsFx(fixture.directory);
		await writeFile(join(fixture.directory, fixture.artifacts[0]), "tampered");

		await expect(verifyDesktopArtifactsFx(fixture.directory)).rejects.toThrow(
			`Checksum mismatch for ${fixture.artifacts[0]}`,
		);
	});
	it("stages only the production build and a dependency-free package manifest", async () => {
		const source = await mkdtemp(join(tmpdir(), "arkini-desktop-build-"));
		const stage = await mkdtemp(join(tmpdir(), "arkini-desktop-stage-"));
		temporaryDirectories.push(source, stage);
		await mkdir(join(source, "main"), {
			recursive: true,
		});
		await writeFile(join(source, "main", "index.js"), "export {};\n");

		const { stageDesktopPackageFx } = await import("../../cli/desktop/stageDesktopPackageFx");
		await stageDesktopPackageFx(source, stage);

		const stagedPackage = JSON.parse(await readFile(join(stage, "package.json"), "utf8"));
		expect(stagedPackage).toEqual({
			name: "arkini",
			version: packageJson.version,
			description: packageJson.description,
			author: packageJson.author,
			type: "module",
			main: "out/main/index.js",
		});
		expect(stagedPackage.dependencies).toBeUndefined();
		expect(await readFile(join(stage, "out", "main", "index.js"), "utf8")).toBe("export {};\n");
	});
});
