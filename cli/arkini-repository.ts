import { Command } from "effect/unstable/cli";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect } from "effect";
import { ArkiniAppVersion } from "../shared/ArkiniAppMetadata";
import { ArkiniRepositoryCommand } from "./ArkiniRepositoryCommand";

// TODO(#397): Migrate the entire command tree and Node runtime edge together to stable
// Effect CLI/platform APIs, preserving command behavior, exit codes, and help output.
Command.run(ArkiniRepositoryCommand, {
	version: ArkiniAppVersion,
}).pipe(Effect.provide(NodeServices.layer), NodeRuntime.runMain);
