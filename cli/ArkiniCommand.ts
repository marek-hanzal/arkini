import { Command } from "effect/unstable/cli";
import { ArkpackCommand } from "./arkpack/ArkpackCommand";
import { DesktopCommand } from "./desktop/DesktopCommand";
import { EditorCommand } from "./editor/EditorCommand";
import { GameCommand } from "~/engine/cli/GameCommand";

// TODO(#397): Keep this root as the checklist entry for every `effect/unstable/cli`
// declaration listed in EFFECT_BETA_MIGRATION.md; migrate the command tree in one pass.
export const ArkiniCommand = Command.make("arkini")
	.pipe(
		Command.withSubcommands([
			ArkpackCommand,
			GameCommand,
			DesktopCommand,
			EditorCommand,
		]),
	)
	.pipe(Command.withDescription("Arkini development commands."));
