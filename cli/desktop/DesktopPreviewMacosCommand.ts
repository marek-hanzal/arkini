import { Command } from "@effect/cli";
import { previewDesktopMacFx } from "./previewDesktopMacFx";

export const DesktopPreviewMacosCommand = Command.make("preview-macos", {}, () =>
	previewDesktopMacFx(),
).pipe(Command.withDescription("Build, package and launch an unpacked macOS arm64 app."));
