import { cp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import packageJson from "../../package.json" with { type: "json" };

export async function stageDesktopPackageFx(
	buildDirectory = "out",
	stageDirectory = "desktop-package",
): Promise<void> {
	await mkdir(stageDirectory, {
		recursive: true,
	});
	await cp(buildDirectory, join(stageDirectory, "out"), {
		recursive: true,
	});
	await writeFile(
		join(stageDirectory, "package.json"),
		`${JSON.stringify(
			{
				name: packageJson.name,
				version: packageJson.version,
				description: packageJson.description,
				author: packageJson.author,
				type: "module",
				main: "out/main/index.js",
			},
			null,
			2,
		)}\n`,
		"utf8",
	);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
	await stageDesktopPackageFx();
}
