import { access, readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { Effect } from "effect";
import { readArkiniProtocolFilePathFx } from "../protocol/readArkiniProtocolFilePathFx";

const representativeRoutes = [
	"arkini://app/",
	"arkini://app/game/example-package",
	"arkini://app/dev/example/deep-route",
] as const;

const readAttributeValues = (
	html: string,
	tagName: "link" | "script",
	attribute: "href" | "src",
) => {
	const values: string[] = [];
	const tagPattern = new RegExp(`<${tagName}\\b[^>]*>`, "gi");
	const attributePattern = new RegExp(`\\b${attribute}=["']([^"']+)["']`, "i");

	for (const tag of html.match(tagPattern) ?? []) {
		const match = attributePattern.exec(tag);
		if (match?.[1]) values.push(match[1]);
	}
	return values;
};

export const verifyRendererAssetGraphFx = Effect.fn("verifyRendererAssetGraphFx")(
	(rendererRoot = "out/renderer") =>
		Effect.gen(function* () {
			const root = resolve(rendererRoot);
			const html = yield* Effect.tryPromise({
				try: () => readFile(resolve(root, "index.html"), "utf8"),
				catch: (cause) => cause,
			});
			const baseMatch = /<base\b[^>]*\bhref=["']([^"']+)["'][^>]*>/i.exec(html);
			const baseHref = baseMatch?.[1];
			if (baseHref !== "/") {
				return yield* Effect.fail(
					new Error('The production renderer must declare <base href="/">.'),
				);
			}

			const references = [
				...readAttributeValues(html, "script", "src"),
				...readAttributeValues(html, "link", "href"),
			].filter((reference) => !reference.startsWith("data:"));
			if (references.length === 0) {
				return yield* Effect.fail(
					new Error("The production renderer index contains no generated entry assets."),
				);
			}

			for (const reference of references) {
				let expectedUrl: string | undefined;
				for (const route of representativeRoutes) {
					const documentBaseUrl = new URL(baseHref, route);
					const assetUrl = new URL(reference, documentBaseUrl);
					if (assetUrl.protocol !== "arkini:" || assetUrl.host !== "app") {
						return yield* Effect.fail(
							new Error(
								`Renderer asset escaped the Arkini application origin: ${assetUrl}`,
							),
						);
					}
					expectedUrl ??= assetUrl.href;
					if (assetUrl.href !== expectedUrl) {
						return yield* Effect.fail(
							new Error(
								`Renderer asset resolves differently from nested routes: ${reference}`,
							),
						);
					}

					const relativeAssetPath = decodeURIComponent(assetUrl.pathname).replace(
						/^\/+/,
						"",
					);
					const assetPath = resolve(root, relativeAssetPath);
					const relativePath = relative(root, assetPath);
					const isSafe =
						relativePath === "" ||
						(!relativePath.startsWith("..") && !isAbsolute(relativePath));
					if (!isSafe) {
						return yield* Effect.fail(
							new Error(
								`Renderer asset path escapes the renderer root: ${reference}`,
							),
						);
					}

					yield* Effect.tryPromise({
						try: () => access(assetPath),
						catch: (cause) => cause,
					});
					const servedPath = yield* readArkiniProtocolFilePathFx({
						requestUrl: assetUrl.href,
						rendererRoot: root,
					});
					if (servedPath !== assetPath) {
						return yield* Effect.fail(
							new Error(
								`Arkini protocol did not serve the generated asset: ${reference}`,
							),
						);
					}
				}
			}
		}),
);
