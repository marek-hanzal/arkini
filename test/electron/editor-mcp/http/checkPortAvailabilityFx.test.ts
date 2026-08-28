import { createServer, type Server } from "node:net";
import { Effect } from "effect";
import { afterEach, describe, expect, it } from "vitest";

import { checkPortAvailabilityFx } from "../../../../electron/main/editor-mcp/http/checkPortAvailabilityFx";

const servers = new Set<Server>();

const listenOnLoopback = () =>
	new Promise<{
		readonly port: number;
		readonly server: Server;
	}>((resolve, reject) => {
		const server = createServer();
		servers.add(server);
		server.once("error", reject);
		server.listen(
			{
				host: "127.0.0.1",
				port: 0,
				exclusive: true,
			},
			() => {
				const address = server.address();
				if (address === null || typeof address === "string") {
					reject(new Error("The loopback test server did not receive a TCP port."));
					return;
				}
				resolve({
					port: address.port,
					server,
				});
			},
		);
	});

const closeServer = (server: Server) =>
	new Promise<void>((resolve, reject) => {
		if (!server.listening) {
			servers.delete(server);
			resolve();
			return;
		}
		server.close((error) => {
			servers.delete(server);
			if (error === undefined) resolve();
			else reject(error);
		});
	});

afterEach(async () => {
	for (const server of servers) await closeServer(server);
});

describe("checkPortAvailabilityFx", () => {
	it.each([
		1_023,
		65_536,
		32_310.5,
		"32310",
		null,
	])("rejects invalid candidate %j without probing", async (candidate) => {
		expect(await Effect.runPromise(checkPortAvailabilityFx(candidate))).toEqual({
			type: "unavailable",
			message: "Use a port from 1024 to 65535.",
		});
	});

	it("reports a released loopback port as available", async () => {
		const { port, server } = await listenOnLoopback();
		await closeServer(server);

		expect(await Effect.runPromise(checkPortAvailabilityFx(port))).toEqual({
			type: "available",
		});
	});

	it("reports an occupied loopback port without disturbing its owner", async () => {
		const { port, server } = await listenOnLoopback();

		expect(await Effect.runPromise(checkPortAvailabilityFx(port))).toEqual({
			type: "unavailable",
			message: `Port ${port} is already in use or cannot be bound.`,
		});
		expect(server.listening).toBe(true);
	});
});
