import { net } from "electron";
import { pathToFileURL } from "node:url";
import { Effect } from "effect";
import { RendererContentSecurityPolicy } from "../security/RendererContentSecurityPolicy";
import { ArkiniProtocolError } from "../protocol/ArkiniProtocolError";
import { readArkiniProtocolFilePathFx } from "../protocol/readArkiniProtocolFilePathFx";

export namespace handleArkiniProtocolRequestFx {
	export interface Props {
		readonly request: Request;
		readonly rendererRoot: string;
	}
}

const withProductionContentSecurityPolicyFn = (response: Response) => {
	const headers = new Headers(response.headers);
	headers.set("Content-Security-Policy", RendererContentSecurityPolicy.production);
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
};

export const handleArkiniProtocolRequestFx = Effect.fn("handleArkiniProtocolRequestFx")(
	({ request, rendererRoot }: handleArkiniProtocolRequestFx.Props) =>
		Effect.gen(function* () {
			if (request.method !== "GET" && request.method !== "HEAD") {
				return withProductionContentSecurityPolicyFn(
					new Response("Method not allowed.", {
						status: 405,
					}),
				);
			}

			const pathOrResponse = yield* readArkiniProtocolFilePathFx({
				requestUrl: request.url,
				rendererRoot,
			}).pipe(
				Effect.catch((error) =>
					Effect.succeed(
						withProductionContentSecurityPolicyFn(
							new Response(error.message, {
								status: error.status,
							}),
						),
					),
				),
			);
			if (pathOrResponse instanceof Response) return pathOrResponse;

			const response = yield* Effect.tryPromise({
				try: () =>
					net.fetch(pathToFileURL(pathOrResponse).toString(), {
						method: request.method,
					}),
				catch: (cause) =>
					cause instanceof ArkiniProtocolError
						? cause
						: new ArkiniProtocolError({
								status: 500,
								message: "Arkini renderer asset could not be served.",
							}),
			});
			return withProductionContentSecurityPolicyFn(response);
		}),
);
