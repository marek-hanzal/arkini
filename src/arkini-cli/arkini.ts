import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect } from "effect";
import { Command } from "effect/unstable/cli";

import { ArkpackCommand } from "~/arkini-cli/command/ArkpackCommand";
import { DiagnosticsCommand } from "~/arkini-cli/command/DiagnosticsCommand";
import { PackCommand } from "~/arkini-cli/command/PackCommand";
import { ReplayCommand } from "~/arkini-cli/command/ReplayCommand";
import { SchemaCommand } from "~/arkini-cli/command/SchemaCommand";
import { ValidateCommand } from "~/arkini-cli/command/ValidateCommand";
import { ArkiniAppVersion } from "~shared/ArkiniAppMetadata";

const GameCommand = Command.make("game")
	.pipe(
		Command.withSubcommands([
			ReplayCommand,
			PackCommand({
				input: "game/arkini",
			}),
			SchemaCommand({
				output: "game/arkini/schema.json",
			}),
			ValidateCommand({
				input: "game/arkini",
			}),
		]),
	)
	.pipe(Command.withDescription("Game authoring, validation and package commands."));

const ArkiniCommand = Command.make("arkini-cli")
	.pipe(
		Command.withSubcommands([
			ArkpackCommand,
			DiagnosticsCommand,
			GameCommand,
		]),
	)
	.pipe(Command.withDescription("Arkini game authoring and Arkpack commands."));

Command.run(ArkiniCommand, {
	version: ArkiniAppVersion,
}).pipe(Effect.provide(NodeServices.layer), NodeRuntime.runMain);
