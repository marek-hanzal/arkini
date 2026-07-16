import { rm } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export async function cleanDesktopPackagingFx(
	releaseDirectory = "release",
	stageDirectory = "desktop-package",
): Promise<void> {
	await Promise.all(
		[
			releaseDirectory,
			stageDirectory,
		].map((directory) =>
			rm(directory, {
				recursive: true,
				force: true,
			}),
		),
	);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
	await cleanDesktopPackagingFx();
}
