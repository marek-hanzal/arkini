import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";
import packageJson from "../../package.json" with { type: "json" };

const artifactNames = [
	`Arkini-${packageJson.version}-mac-arm64.dmg`,
	`Arkini-${packageJson.version}-mac-arm64.zip`,
] as const;

export async function createDesktopChecksumsFx(directory = "release"): Promise<void> {
	const lines = await Promise.all(
		artifactNames.map(async (name) => {
			const bytes = await readFile(join(directory, name));
			const hash = createHash("sha256").update(bytes).digest("hex");
			return `${hash}  ${basename(name)}`;
		}),
	);

	await writeFile(join(directory, "SHA256SUMS"), `${lines.join("\n")}\n`, "utf8");
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
	await createDesktopChecksumsFx(process.argv[2]);
}
