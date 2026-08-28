import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect } from "effect";
import { Command } from "effect/unstable/cli";

import { ArkiniCommand } from "./ArkiniCommand";
import { ArkiniAppVersion } from "../../../shared/ArkiniAppMetadata";

Command.run(ArkiniCommand, {
	version: ArkiniAppVersion,
}).pipe(Effect.provide(NodeServices.layer), NodeRuntime.runMain);
