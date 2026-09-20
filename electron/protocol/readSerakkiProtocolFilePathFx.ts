import { access } from "node:fs/promises";
import { extname, isAbsolute, relative, resolve } from "node:path";
import { Effect } from "effect";
import { SerakkiProtocolError } from "./SerakkiProtocolError";

export namespace readSerakkiProtocolFilePathFx {
	export interface Props {
		readonly requestUrl: string;
		readonly rendererRoot: string;
	}
}

export const readSerakkiProtocolFilePathFx = Effect.fn("readSerakkiProtocolFilePathFx")(
	({ requestUrl, rendererRoot }: readSerakkiProtocolFilePathFx.Props) =>
		Effect.gen(function* () {
			const url = new URL(requestUrl);
			if (url.protocol !== "serakki:" || url.host !== "app") {
				return yield* Effect.fail(
					new SerakkiProtocolError({
						status: 404,
						message: "Unknown Serakki protocol origin.",
					}),
				);
			}

			let pathname: string;
			try {
				pathname = decodeURIComponent(url.pathname);
			} catch {
				return yield* Effect.fail(
					new SerakkiProtocolError({
						status: 400,
						message: "Malformed Serakki protocol path.",
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
					new SerakkiProtocolError({
						status: 400,
						message: "Serakki protocol path escapes the renderer root.",
					}),
				);
			}

			const exists = yield* Effect.tryPromise({
				try: () => access(requestedPath).then(() => true),
				catch: (cause) => cause,
			}).pipe(Effect.catch(() => Effect.succeed(false)));
			if (exists) return requestedPath;
			if (extname(relativeRequestPath)) {
				return yield* Effect.fail(
					new SerakkiProtocolError({
						status: 404,
						message: "Serakki renderer resource was not found.",
					}),
				);
			}
			return resolve(rendererRoot, "index.html");
		}),
);
