import { net } from "electron";
import { pathToFileURL } from "node:url";
import { Effect } from "effect";
import { RendererContentSecurityPolicy } from "../security/RendererContentSecurityPolicy";
import { SerakkiProtocolError } from "../protocol/SerakkiProtocolError";
import { readSerakkiProtocolFilePathFx } from "../protocol/readSerakkiProtocolFilePathFx";

export namespace handleSerakkiProtocolRequestFx {
	export interface Props {
		readonly request: Request;
		readonly rendererRoot: string;
		readonly handleEditorResourceRequestFx?: (
			request: Request,
		) => Effect.Effect<Response, never, never>;
		readonly handleGameResourceRequestFx?: (
			request: Request,
		) => Effect.Effect<Response, never, never>;
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

export const handleSerakkiProtocolRequestFx = Effect.fn("handleSerakkiProtocolRequestFx")(
	({
		request,
		rendererRoot,
		handleEditorResourceRequestFx,
		handleGameResourceRequestFx,
	}: handleSerakkiProtocolRequestFx.Props) =>
		Effect.gen(function* () {
			const url = new URL(request.url);
			if (url.host === "app" && url.pathname === "/editor/resource") {
				return handleEditorResourceRequestFx === undefined
					? new Response("Editor storage is unavailable.", {
							status: 503,
						})
					: yield* handleEditorResourceRequestFx(request);
			}
			if (url.host === "app" && url.pathname === "/game/resource") {
				return handleGameResourceRequestFx === undefined
					? new Response("Game storage is unavailable.", {
							status: 503,
						})
					: yield* handleGameResourceRequestFx(request);
			}
			if (request.method !== "GET" && request.method !== "HEAD") {
				return withProductionContentSecurityPolicyFn(
					new Response("Method not allowed.", {
						status: 405,
					}),
				);
			}

			const pathOrResponse = yield* readSerakkiProtocolFilePathFx({
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
					cause instanceof SerakkiProtocolError
						? cause
						: new SerakkiProtocolError({
								status: 500,
								message: "Serakki renderer resource could not be served.",
							}),
			});
			return withProductionContentSecurityPolicyFn(response);
		}),
);
