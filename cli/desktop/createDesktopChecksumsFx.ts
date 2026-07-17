import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { Effect } from "effect";
import packageJson from "../../package.json" with { type: "json" };
import { DesktopPackagingError } from "./DesktopPackagingError";

const artifactNames = [
	`Arkini-${packageJson.version}-mac-arm64.dmg`,
	`Arkini-${packageJson.version}-mac-arm64.zip`,
] as const;

export namespace createDesktopChecksumsFx {
	export interface Props {
		readonly directory?: string;
	}
}

export const createDesktopChecksumsFx = Effect.fn("createDesktopChecksumsFx")(
	({ directory = "release" }: createDesktopChecksumsFx.Props = {}) =>
		Effect.tryPromise({
			try: async () => {
				const lines = await Promise.all(
					artifactNames.map(async (name) => {
						const bytes = await readFile(join(directory, name));
						const hash = createHash("sha256").update(bytes).digest("hex");
						return `${hash}  ${basename(name)}`;
					}),
				);

				await writeFile(join(directory, "SHA256SUMS"), `${lines.join("\n")}\n`, "utf8");
			},
			catch: (cause) =>
				new DesktopPackagingError({
					operation: "create desktop artifact checksums",
					cause,
				}),
		}),
);
