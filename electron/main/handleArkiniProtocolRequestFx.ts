import { net } from "electron";
import { pathToFileURL } from "node:url";
import { Effect } from "effect";
import { ArkiniProtocolError } from "../protocol/ArkiniProtocolError";
import { readArkiniProtocolFilePathFx } from "../protocol/readArkiniProtocolFilePathFx";

export namespace handleArkiniProtocolRequestFx {
	export interface Props {
		readonly request: Request;
		readonly rendererRoot: string;
	}
}

export const handleArkiniProtocolRequestFx = Effect.fn("handleArkiniProtocolRequestFx")(
	({ request, rendererRoot }: handleArkiniProtocolRequestFx.Props) =>
		Effect.gen(function* () {
			if (request.method !== "GET" && request.method !== "HEAD") {
				return new Response("Method not allowed.", {
					status: 405,
				});
			}

			const pathOrResponse = yield* readArkiniProtocolFilePathFx({
				requestUrl: request.url,
				rendererRoot,
			}).pipe(
				Effect.catchAll((error) =>
					Effect.succeed(
						new Response(error.message, {
							status: error.status,
						}),
					),
				),
			);
			if (pathOrResponse instanceof Response) return pathOrResponse;

			return yield* Effect.tryPromise({
				try: () =>
					net.fetch(pathToFileURL(pathOrResponse).toString(), {
						method: request.method,
					}),
				catch: (cause) =>
					cause instanceof ArkiniProtocolError
						? cause
						: new ArkiniProtocolError(
								500,
								"Arkini renderer asset could not be served.",
							),
			});
		}),
);
