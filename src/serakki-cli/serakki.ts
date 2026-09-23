import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect } from "effect";
import { Command } from "effect/unstable/cli";

import { SerapackCommand } from "~/serakki-cli/command/SerapackCommand";
import { DiagnosticsCommand } from "~/serakki-cli/command/DiagnosticsCommand";
import { EditorMcpCommand } from "~/serakki-cli/command/EditorMcpCommand";
import { EditorImportCommand } from "~/serakki-cli/command/EditorImportCommand";
import { PackCommand } from "~/serakki-cli/command/PackCommand";
import { ProjectCommand } from "~/serakki-cli/command/ProjectCommand";
import { ReplayCommand } from "~/serakki-cli/command/ReplayCommand";
import { SchemaCommand } from "~/serakki-cli/command/SchemaCommand";
import { ValidateCommand } from "~/serakki-cli/command/ValidateCommand";
import { SerakkiAppVersion } from "~shared/SerakkiAppMetadata";

const GameCommand = Command.make("game")
	.pipe(
		Command.withSubcommands([
			ReplayCommand,
			PackCommand({
				input: "game/serakki",
			}),
			SchemaCommand({
				output: "game/serakki/schema.json",
			}),
			ValidateCommand({
				input: "game/serakki",
			}),
		]),
	)
	.pipe(Command.withDescription("Game authoring, validation and package commands."));

const EditorCommand = Command.make("editor")
	.pipe(
		Command.withSubcommands([
			EditorMcpCommand,
			EditorImportCommand,
		]),
	)
	.pipe(Command.withDescription("Editor project commands."));

const SerakkiCommand = Command.make("serakki-cli")
	.pipe(
		Command.withSubcommands([
			SerapackCommand,
			DiagnosticsCommand,
			EditorCommand,
			GameCommand,
			ProjectCommand,
		]),
	)
	.pipe(Command.withDescription("Serakki game authoring and Serapack commands."));

Command.run(SerakkiCommand, {
	version: SerakkiAppVersion,
}).pipe(Effect.provide(NodeServices.layer), NodeRuntime.runMain);
