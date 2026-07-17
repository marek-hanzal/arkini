import { protocol } from "electron";
import { Effect } from "effect";
import { ElectronMainRuntime } from "./ElectronMainRuntime";
import { handleArkiniProtocolRequestFx } from "./handleArkiniProtocolRequestFx";

export const registerArkiniProtocolFx = Effect.fn("registerArkiniProtocolFx")(
	(rendererRoot: string) =>
		Effect.sync(() => {
			protocol.handle("arkini", (request) =>
				ElectronMainRuntime.runPromise(
					handleArkiniProtocolRequestFx({
						request,
						rendererRoot,
					}),
				),
			);
		}),
);
