import { rm } from "node:fs/promises";
import { Effect } from "effect";
import { ProjectOutputPaths } from "../../shared/ProjectOutputPaths";
import { DesktopPackagingError } from "./DesktopPackagingError";

export namespace cleanDesktopPackagingFx {
	export interface Props {
		readonly directory?: string;
	}
}

export const cleanDesktopPackagingFx = Effect.fn("cleanDesktopPackagingFx")(
	({ directory = ProjectOutputPaths.desktop.root }: cleanDesktopPackagingFx.Props = {}) =>
		Effect.tryPromise({
			try: () =>
				rm(directory, {
					recursive: true,
					force: true,
				}),
			catch: (cause) =>
				new DesktopPackagingError({
					operation: "clean desktop packaging directories",
					cause,
				}),
		}),
);
