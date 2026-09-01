import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { resolve } from "node:path";
import { Effect } from "effect";
import { Command } from "effect/unstable/cli";

import { tx } from "./translation/tx";
import { TranslationSources } from "~/translation/constant/TranslationSources";

const runTranslationsFx = (mode: tx.Props["mode"]) =>
	tx({
		locales: [
			"en",
		],
		mode,
		packages: [
			resolve("."),
		],
		runtimeOutput: {
			locale: "en",
			path: resolve("src/translation/constant/EnglishTranslations.ts"),
		},
		sourceDirectory: resolve("src/translation"),
		sources: TranslationSources,
	});

const TranslationCheckCommand = Command.make("check", {}, () => runTranslationsFx("check")).pipe(
	Command.withDescription("Check the runtime translation catalog and remove no files."),
);

const TranslationSyncCommand = Command.make("sync", {}, () => runTranslationsFx("sync")).pipe(
	Command.withDescription("Synchronize translation sources and remove dead static keys."),
);

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
}).pipe(Effect.provide(NodeServices.layer), NodeRuntime.runMain);
