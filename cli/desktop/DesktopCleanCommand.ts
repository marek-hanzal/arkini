import { Command } from "@effect/cli";
import { cleanDesktopPackagingFx } from "./cleanDesktopPackagingFx";

export const DesktopCleanCommand = Command.make("clean", {}, () => cleanDesktopPackagingFx()).pipe(
	Command.withDescription("Remove staged and packaged desktop output."),
);
