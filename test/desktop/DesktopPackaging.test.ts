import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPackage } from "@electron/asar";
import { NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import packageJson from "../../package.json" with { type: "json" };
import { afterEach, describe, expect, it } from "vitest";
import { createDesktopChecksumsFx } from "../../cli/desktop/createDesktopChecksumsFx";
import { verifyDesktopArtifactsFx } from "../../cli/desktop/verifyDesktopArtifactsFx";
import { verifyDesktopPackageStructureFx } from "../../cli/desktop/verifyDesktopPackageStructureFx";

const temporaryDirectories: string[] = [];

const createReleaseFixture = async ({ includeNodeModules = false } = {}) => {
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
	const asarSource = join(directory, "asar-source");
	await mkdir(asarSource);
	await writeFile(join(asarSource, "package.json"), "{}\n");
	if (includeNodeModules) {
		await mkdir(join(asarSource, "node_modules", "fixture"), {
			recursive: true,
		});
		await writeFile(join(asarSource, "node_modules", "fixture", "index.js"), "export {};\n");
	}
	await createPackage(asarSource, join(resources, "app.asar"));
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
		await Effect.runPromise(
			createDesktopChecksumsFx({
				directory: fixture.directory,
			}).pipe(Effect.provide(NodeServices.layer)),
		);
		await expect(
			Effect.runPromise(
				verifyDesktopArtifactsFx({
					directory: fixture.directory,
				}).pipe(Effect.provide(NodeServices.layer)),
			),
		).resolves.toBeUndefined();

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
		await Effect.runPromise(
			createDesktopChecksumsFx({
				directory: fixture.directory,
			}).pipe(Effect.provide(NodeServices.layer)),
		);
		await writeFile(join(fixture.directory, fixture.artifacts[0]), "tampered");

		await expect(
			Effect.runPromise(
				Effect.flip(
					verifyDesktopArtifactsFx({
						directory: fixture.directory,
					}).pipe(Effect.provide(NodeServices.layer)),
				),
			),
		).resolves.toMatchObject({
			_tag: "DesktopPackagingError",
			operation: "verify desktop artifacts",
			cause: expect.objectContaining({
				message: `Checksum mismatch for ${fixture.artifacts[0]}`,
			}),
		});
	});

	it("rejects packaged node_modules", async () => {
		const fixture = await createReleaseFixture({
			includeNodeModules: true,
		});

		await expect(
			Effect.runPromise(
				Effect.flip(
					verifyDesktopPackageStructureFx({
						directory: fixture.directory,
					}).pipe(Effect.provide(NodeServices.layer)),
				),
			),
		).resolves.toMatchObject({
			_tag: "DesktopPackagingError",
			operation: "verify packaged desktop structure",
			cause: expect.objectContaining({
				message: "Packaged app.asar contains node_modules.",
			}),
		});
	});

	it("stages the optimized production build with its Electron entrypoint", async () => {
		const source = await mkdtemp(join(tmpdir(), "arkini-desktop-build-"));
		const stage = await mkdtemp(join(tmpdir(), "arkini-desktop-stage-"));
		temporaryDirectories.push(source, stage);
		await mkdir(join(source, "main"), {
			recursive: true,
		});
		await writeFile(join(source, "main", "index.js"), "export {};\n");

		const { stageDesktopPackageFx } = await import("../../cli/desktop/stageDesktopPackageFx");
		await Effect.runPromise(
			stageDesktopPackageFx({
				buildDirectory: source,
				stageDirectory: stage,
			}),
		);

		const stagedPackage = JSON.parse(await readFile(join(stage, "package.json"), "utf8"));
		expect(stagedPackage).toEqual({
			name: "arkini",
			version: packageJson.version,
			description: packageJson.description,
			author: packageJson.author,
			type: "module",
			main: "app/main/index.js",
		});
		expect(await readFile(join(stage, "app", "main", "index.js"), "utf8")).toBe("export {};\n");
	});
});
