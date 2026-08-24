import { Command } from "effect/unstable/cli";

import { packOfficialArkiniFx } from "./packOfficialArkiniFx";

export const ArkpackOfficialPackCommand = Command.make("pack-official", {}, () =>
	packOfficialArkiniFx(),
).pipe(Command.withDescription("Pack, sign, and post-verify the bundled official Arkini package."));
