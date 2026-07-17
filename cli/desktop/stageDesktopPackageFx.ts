import { cp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Effect } from "effect";
import packageJson from "../../package.json" with { type: "json" };
import { DesktopPackagingError } from "./DesktopPackagingError";

export namespace stageDesktopPackageFx {
	export interface Props {
		readonly buildDirectory?: string;
		readonly stageDirectory?: string;
	}
}

export const stageDesktopPackageFx = Effect.fn("stageDesktopPackageFx")(
	({
		buildDirectory = "out",
		stageDirectory = "desktop-package",
	}: stageDesktopPackageFx.Props = {}) =>
		Effect.tryPromise({
			try: async () => {
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
			},
			catch: (cause) =>
				new DesktopPackagingError({
					operation: "stage desktop application",
					cause,
				}),
		}),
);
