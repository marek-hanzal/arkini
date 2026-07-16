import { createHash } from "node:crypto";
import { access, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import packageJson from "../../package.json" with { type: "json" };

const artifactNames = [
	`Arkini-${packageJson.version}-mac-arm64.dmg`,
	`Arkini-${packageJson.version}-mac-arm64.zip`,
] as const;

export async function verifyDesktopArtifactsFx(directory = "release"): Promise<void> {
	const checksumLines = (await readFile(join(directory, "SHA256SUMS"), "utf8"))
		.trim()
		.split("\n")
		.filter(Boolean);
	const expectedNames = new Set(artifactNames);

	if (checksumLines.length !== expectedNames.size) {
		throw new Error("SHA256SUMS must contain exactly the macOS DMG and ZIP artifacts.");
	}

	for (const line of checksumLines) {
		const match = /^([a-f0-9]{64})  (.+)$/.exec(line);
		if (!match) throw new Error(`Invalid SHA256SUMS line: ${line}`);
		const [, expectedHash, name] = match;
		if (!expectedNames.delete(name as (typeof artifactNames)[number])) {
			throw new Error(`Unexpected or duplicate desktop artifact: ${name}`);
		}
		const path = join(directory, name);
		const file = await stat(path);
		if (!file.isFile() || file.size === 0)
			throw new Error(`Desktop artifact is empty: ${name}`);
		const actualHash = createHash("sha256")
			.update(await readFile(path))
			.digest("hex");
		if (actualHash !== expectedHash) throw new Error(`Checksum mismatch for ${name}`);
	}

	if (expectedNames.size > 0) {
		throw new Error(
			`Missing desktop artifact checksums: ${[
				...expectedNames,
			].join(", ")}`,
		);
	}

	await access(join(directory, "mac-arm64", "Arkini.app", "Contents", "Resources", "app.asar"));
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
	await verifyDesktopArtifactsFx(process.argv[2]);
}
