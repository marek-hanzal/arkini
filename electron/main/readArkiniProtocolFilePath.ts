import { access } from "node:fs/promises";
import { extname, isAbsolute, relative, resolve } from "node:path";
import { ArkiniProtocolError } from "./ArkiniProtocolError";

export async function readArkiniProtocolFilePath(
	requestUrl: string,
	rendererRoot: string,
): Promise<string> {
	const url = new URL(requestUrl);

	if (url.protocol !== "arkini:" || url.host !== "app") {
		throw new ArkiniProtocolError(404, "Unknown Arkini protocol origin.");
	}

	let pathname: string;
	try {
		pathname = decodeURIComponent(url.pathname);
	} catch {
		throw new ArkiniProtocolError(400, "Malformed Arkini protocol path.");
	}

	const relativeRequestPath = pathname.replace(/^\/+/, "");
	const requestedPath = resolve(rendererRoot, relativeRequestPath || "index.html");
	const relativePath = relative(rendererRoot, requestedPath);
	const isSafe =
		relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));

	if (!isSafe) {
		throw new ArkiniProtocolError(400, "Arkini protocol path escapes the renderer root.");
	}

	try {
		await access(requestedPath);
		return requestedPath;
	} catch {
		if (extname(relativeRequestPath)) {
			throw new ArkiniProtocolError(404, "Arkini renderer asset was not found.");
		}

		return resolve(rendererRoot, "index.html");
	}
}
