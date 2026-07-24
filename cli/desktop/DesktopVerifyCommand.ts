import { Command } from "effect/unstable/cli";
import { verifyDesktopArtifactsFx } from "./verifyDesktopArtifactsFx";

export const DesktopVerifyCommand = Command.make("verify", {}, () =>
	verifyDesktopArtifactsFx(),
).pipe(Command.withDescription("Verify packaged desktop artifacts and checksums."));
