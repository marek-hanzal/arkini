import { access, readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { readArkiniProtocolFilePath } from "../main/readArkiniProtocolFilePath";

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

export async function verifyRendererAssetGraphFx(rendererRoot = "out/renderer"): Promise<void> {
	const indexPath = resolve(rendererRoot, "index.html");
	const html = await readFile(indexPath, "utf8");
	const baseMatch = /<base\b[^>]*\bhref=["']([^"']+)["'][^>]*>/i.exec(html);
	const baseHref = baseMatch?.[1];

	if (baseHref !== "/") {
		throw new Error('The production renderer must declare <base href="/">.');
	}

	const references = [
		...readAttributeValues(html, "script", "src"),
		...readAttributeValues(html, "link", "href"),
	].filter((reference) => !reference.startsWith("data:"));

	if (references.length === 0) {
		throw new Error("The production renderer index contains no generated entry assets.");
	}

	for (const reference of references) {
		let expectedUrl: string | undefined;

		for (const route of representativeRoutes) {
			const documentBaseUrl = new URL(baseHref, route);
			const assetUrl = new URL(reference, documentBaseUrl);

			if (assetUrl.protocol !== "arkini:" || assetUrl.host !== "app") {
				throw new Error(
					`Renderer asset escaped the Arkini application origin: ${assetUrl}`,
				);
			}

			expectedUrl ??= assetUrl.href;
			if (assetUrl.href !== expectedUrl) {
				throw new Error(
					`Renderer asset resolves differently from nested routes: ${reference}`,
				);
			}

			const relativeAssetPath = decodeURIComponent(assetUrl.pathname).replace(/^\/+/, "");
			const assetPath = resolve(rendererRoot, relativeAssetPath);
			const relativePath = relative(resolve(rendererRoot), assetPath);
			const isSafe =
				relativePath === "" ||
				(!relativePath.startsWith("..") && !isAbsolute(relativePath));

			if (!isSafe) {
				throw new Error(`Renderer asset path escapes the renderer root: ${reference}`);
			}

			await access(assetPath);
			const servedPath = await readArkiniProtocolFilePath(assetUrl.href, rendererRoot);
			if (servedPath !== assetPath) {
				throw new Error(`Arkini protocol resolved the wrong renderer asset: ${assetUrl}`);
			}
		}
	}
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
	await verifyRendererAssetGraphFx(process.argv[2]);
}
