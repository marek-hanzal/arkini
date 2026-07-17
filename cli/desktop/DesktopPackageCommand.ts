import { Command, Options } from "@effect/cli";
import { packageDesktopMacFx } from "./packageDesktopMacFx";

const architecture = Options.choice("arch", [
	"arm64",
] as const).pipe(
	Options.withDefault("arm64"),
	Options.withDescription(
		"Target macOS architecture. The current milestone supports arm64 only.",
	),
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
