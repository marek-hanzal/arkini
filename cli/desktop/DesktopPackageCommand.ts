import { Command, Flag } from "effect/unstable/cli";
import { packageDesktopMacFx } from "./packageDesktopMacFx";

const architecture = Flag.choice("arch", [
	"arm64",
] as const).pipe(
	Flag.withDefault("arm64"),
	Flag.withDescription("Target macOS architecture. The current milestone supports arm64 only."),
);

export const DesktopPackageCommand = Command.make(
	"package",
	{
		arch: architecture,
	},
	({ arch }) =>
		packageDesktopMacFx({
			arch,
		}),
).pipe(Command.withDescription("Create unsigned macOS DMG and ZIP artifacts."));
