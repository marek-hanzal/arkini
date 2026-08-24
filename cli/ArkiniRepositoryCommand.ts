import { Command } from "effect/unstable/cli";
import { DesktopCommand } from "./desktop/DesktopCommand";

// TODO(#397): Keep this root as the checklist entry for every `effect/unstable/cli`
// declaration listed in EFFECT_BETA_MIGRATION.md; migrate the command tree in one pass.
export const ArkiniRepositoryCommand = Command.make("arkini-repository")
	.pipe(
		Command.withSubcommands([
			DesktopCommand,
		]),
	)
	.pipe(Command.withDescription("Arkini repository desktop delivery commands."));
