import { access } from "node:fs/promises";
import { extname, isAbsolute, relative, resolve } from "node:path";
import { Effect } from "effect";
import { ArkiniProtocolError } from "./ArkiniProtocolError";

export namespace readArkiniProtocolFilePathFx {
	export interface Props {
		readonly requestUrl: string;
		readonly rendererRoot: string;
	}
}

export const readArkiniProtocolFilePathFx = Effect.fn("readArkiniProtocolFilePathFx")(
	({ requestUrl, rendererRoot }: readArkiniProtocolFilePathFx.Props) =>
		Effect.gen(function* () {
			const url = new URL(requestUrl);
			if (url.protocol !== "arkini:" || url.host !== "app") {
				return yield* Effect.fail(
					new ArkiniProtocolError({
						status: 404,
						message: "Unknown Arkini protocol origin.",
					}),
				);
			}

			let pathname: string;
			try {
				pathname = decodeURIComponent(url.pathname);
			} catch {
				return yield* Effect.fail(
					new ArkiniProtocolError({
						status: 400,
						message: "Malformed Arkini protocol path.",
					}),
				);
			}

			const relativeRequestPath = pathname.replace(/^\/+/, "");
			const requestedPath = resolve(rendererRoot, relativeRequestPath || "index.html");
			const relativePath = relative(rendererRoot, requestedPath);
			const isSafe =
				relativePath === "" ||
				(!relativePath.startsWith("..") && !isAbsolute(relativePath));
			if (!isSafe) {
				return yield* Effect.fail(
					new ArkiniProtocolError({
						status: 400,
						message: "Arkini protocol path escapes the renderer root.",
					}),
				);
			}

			const exists = yield* Effect.tryPromise({
				try: () => access(requestedPath).then(() => true),
				catch: (cause) => cause,
			}).pipe(Effect.catchAll(() => Effect.succeed(false)));
			if (exists) return requestedPath;
			if (extname(relativeRequestPath)) {
				return yield* Effect.fail(
					new ArkiniProtocolError({
						status: 404,
						message: "Arkini renderer asset was not found.",
					}),
				);
			}
			return resolve(rendererRoot, "index.html");
		}),
);
