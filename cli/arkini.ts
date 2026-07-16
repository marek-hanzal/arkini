import { Command } from "@effect/cli";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { Effect } from "effect";

import { ArkiniCommand } from "~/engine/cli/ArkiniCommand";

Command.run(ArkiniCommand, {
	name: "Arkini",
	version: "0.1.0",
})(process.argv).pipe(Effect.provide(NodeContext.layer), NodeRuntime.runMain);
