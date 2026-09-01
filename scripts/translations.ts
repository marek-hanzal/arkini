import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { resolve } from "node:path";
import { Effect } from "effect";
import { Command } from "effect/unstable/cli";

import { tx } from "./translation/tx";
import { TranslationSources } from "~/translation/constant/TranslationSources";

const TranslationConfig = {
	packages: [
		resolve("."),
	],
	sourceDirectory: resolve("src/translation"),
	sources: TranslationSources,
} as const;

const TranslationCheckCommand = Command.make("check", {}, () =>
	tx({
		...TranslationConfig,
		mode: "check",
	}),
).pipe(Command.withDescription("Check translation catalogs without changing files."));

const TranslationSyncCommand = Command.make("sync", {}, () =>
	tx({
		...TranslationConfig,
		mode: "sync",
	}),
).pipe(Command.withDescription("Synchronize translation catalogs and remove dead static keys."));

const TranslationsCommand = Command.make("translations")
	.pipe(
		Command.withSubcommands([
			TranslationCheckCommand,
			TranslationSyncCommand,
		]),
	)
	.pipe(Command.withDescription("Offline application translation authoring commands."));

Command.run(TranslationsCommand, {
	version: "1.0.0",
}).pipe(
	Effect.catchTags({
		TranslationOutOfSyncError: ({ paths }) =>
			Effect.fail(new Error(`Translation catalogs are out of sync: ${paths.join(", ")}`)),
		TranslationSyncError: ({ cause, message }) =>
			Effect.fail(
				new Error(message, {
					cause,
				}),
			),
	}),
	Effect.provide(NodeServices.layer),
	NodeRuntime.runMain,
);
