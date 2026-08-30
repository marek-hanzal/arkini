import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect } from "effect";
import { Command } from "effect/unstable/cli";

import { ArkpackCommand } from "~/arkpack/artifact/cli/ArkpackCommand";
import { PackCommand } from "~/arkpack/artifact/cli/PackCommand";
import { SchemaCommand } from "~/game-config/cli/SchemaCommand";
import { ValidateCommand } from "~/game-config/cli/ValidateCommand";
import { ArkiniAppVersion } from "../../shared/ArkiniAppMetadata";

const GameCommand = Command.make("game")
	.pipe(
		Command.withSubcommands([
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
			GameCommand,
		]),
	)
	.pipe(Command.withDescription("Arkini game authoring and Arkpack commands."));

Command.run(ArkiniCommand, {
	version: ArkiniAppVersion,
}).pipe(Effect.provide(NodeServices.layer), NodeRuntime.runMain);
