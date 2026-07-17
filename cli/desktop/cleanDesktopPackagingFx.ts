import { rm } from "node:fs/promises";
import { Effect } from "effect";
import { DesktopPackagingError } from "./DesktopPackagingError";

export namespace cleanDesktopPackagingFx {
	export interface Props {
		readonly releaseDirectory?: string;
		readonly stageDirectory?: string;
	}
}

export const cleanDesktopPackagingFx = Effect.fn("cleanDesktopPackagingFx")(
	({
		releaseDirectory = "release",
		stageDirectory = "desktop-package",
	}: cleanDesktopPackagingFx.Props = {}) =>
		Effect.tryPromise({
			try: () =>
				Promise.all(
					[
						releaseDirectory,
						stageDirectory,
					].map((directory) =>
						rm(directory, {
							recursive: true,
							force: true,
						}),
					),
				).then(() => undefined),
			catch: (cause) =>
				new DesktopPackagingError({
					operation: "clean desktop packaging directories",
					cause,
				}),
		}),
);
