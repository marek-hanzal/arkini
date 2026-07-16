import { net, protocol } from "electron";
import { pathToFileURL } from "node:url";
import { ArkiniProtocolError } from "./ArkiniProtocolError";
import { readArkiniProtocolFilePath } from "./readArkiniProtocolFilePath";

export async function registerArkiniProtocol(rendererRoot: string): Promise<void> {
	protocol.handle("arkini", async (request) => {
		if (request.method !== "GET" && request.method !== "HEAD") {
			return new Response("Method not allowed.", {
				status: 405,
			});
		}

		try {
			const path = await readArkiniProtocolFilePath(request.url, rendererRoot);
			return net.fetch(pathToFileURL(path).toString(), {
				method: request.method,
			});
		} catch (error) {
			if (error instanceof ArkiniProtocolError) {
				return new Response(error.message, {
					status: error.status,
				});
			}

			throw error;
		}
	});
}
