import { Command } from "@effect/cli";
import { createDesktopChecksumsFx } from "./createDesktopChecksumsFx";

export const DesktopChecksumsCommand = Command.make("checksums", {}, () =>
	createDesktopChecksumsFx(),
).pipe(Command.withDescription("Write SHA256SUMS for packaged DMG and ZIP artifacts."));
