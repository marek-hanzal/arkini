import { Command } from "effect/unstable/cli";
import { NodeServices, NodeRuntime } from "@effect/platform-node";
import { Effect } from "effect";
import { ArkiniCommand } from "./ArkiniCommand";

// TODO(#397): Migrate the entire command tree and Node runtime edge together to stable
// Effect CLI/platform APIs, preserving command behavior, exit codes, and help output.
Command.run(ArkiniCommand, {
	version: "0.1.0",
}).pipe(Effect.provide(NodeServices.layer), NodeRuntime.runMain);
