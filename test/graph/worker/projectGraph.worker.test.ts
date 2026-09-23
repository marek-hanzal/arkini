import { once } from "node:events";
import { resolve } from "node:path";
import { Worker } from "node:worker_threads";
import { gzipSync } from "node:zlib";
import { build } from "vite";
import { Effect } from "effect";
import { expect, it } from "vitest";
import { createProjectGraphFx } from "~/graph/fx/createProjectGraphFx";
import { GraphQuerySchema } from "~/graph/schema/GraphQuerySchema";
import { readItemChainQueryFn } from "~/graph/fn/readItemChainQueryFn";
import { readItemConnectionQueryFn } from "~/graph/fn/readItemConnectionQueryFn";
import type { Project } from "~/project-authoring/type/Project";
import type { GraphWorkerResponse } from "~/graph/worker/GraphWorkerProtocol";
import {
	adversarialConfigFn,
	configFn,
	itemFn,
	lineFn,
	outputFn,
} from "../fn/compileGraphFactsFn.test/fixtures";

it("runs the browser-bundled DataScript worker with the same canonical answers as Node and bounded large graphs", async () => {
	const built = await build({
		configFile: false,
		logLevel: "silent",
		resolve: {
			alias: {
				"~": resolve("src"),
			},
		},
		build: {
			write: false,
			minify: true,
			lib: {
				entry: resolve("src/graph/worker/projectGraph.worker.ts"),
				formats: [
					"es",
				],
				fileName: "graph",
			},
		},
	});
	const bundle = Array.isArray(built) ? built[0] : built;
	if (!("output" in bundle)) throw new Error("Expected one browser worker bundle.");
	const chunk = bundle.output.find((output) => output.type === "chunk");
	if (chunk?.type !== "chunk") throw new Error("Missing browser worker entry.");
	// Only the worker message transport is adapted; execute the actual browser bundle unchanged.
	const worker = new Worker(
		`
		const { parentPort } = require('node:worker_threads');
		globalThis.self = { postMessage: (data) => parentPort.postMessage(data) };
		import(${JSON.stringify(`data:text/javascript;base64,${Buffer.from(chunk.code).toString("base64")}`)}).then(() => {
			parentPort.on('message', (data) => self.onmessage({ data }));
			parentPort.postMessage({ ready: true });
		});
	`,
		{
			eval: true,
		},
	);
	try {
		await once(worker, "message");
		const graph = await Effect.runPromise(createProjectGraphFx());
		const project: Project = {
			projectId: "parity",
			revision: 1,
			title: "Parity",
			version: {
				major: 1,
				minor: 0,
			},
			createdAtMs: 0,
			updatedAtMs: 0,
			resources: [],
			config: adversarialConfigFn(),
		};
		let requestId = 0;
		const requestFn = async (project: Project, query: GraphQuerySchema.Type) => {
			const response = once(worker, "message");
			worker.postMessage({
				kind: "query",
				requestId: ++requestId,
				project,
				query,
			});
			const [message] = (await response) as [
				GraphWorkerResponse,
			];
			if (message.status !== "success") throw new Error(message.message);
			return message.result;
		};
		for (const query of [
			readItemConnectionQueryFn("A", "all"),
			readItemChainQueryFn("A"),
			GraphQuerySchema.parse({
				kind: "connections",
				from: "item:B",
				direction: "in",
				kinds: [
					"merge-target",
				],
			}),
			GraphQuerySchema.parse({
				kind: "path",
				from: "item:C",
				to: "space:7",
				maxDepth: 4,
				limit: 3,
			}),
			GraphQuerySchema.parse({
				kind: "node",
				from: "item:A",
			}),
		]) {
			expect(await requestFn(project, query)).toEqual(
				await Effect.runPromise(graph.queryFx(project, query)),
			);
		}
		const changed = {
			...project,
			revision: 2,
			config: structuredClone(project.config),
		};
		changed.config.items.A.title = "New revision";
		const nodeQuery = GraphQuerySchema.parse({
			kind: "node",
			from: "item:A",
		});
		expect((await requestFn(changed, nodeQuery)).nodes[0].title).toBe("New revision");
		changed.config.items.A.title = "Same-marker replacement";
		expect((await requestFn(changed, nodeQuery)).nodes[0].title).toBe(
			"Same-marker replacement",
		);

		const count = 2000;
		const config = configFn(
			Object.fromEntries(
				Array.from(
					{
						length: count,
					},
					(_, index) => {
						const uid = `item-${index}`;
						return [
							uid,
							itemFn(uid, {
								lines: Array.from(
									{
										length: 3,
									},
									(_, branch) =>
										lineFn(`line-${branch}`, {
											outcome: outputFn(
												`item-${(index + branch + 1) % count}`,
											),
										}),
								),
							}),
						];
					},
				),
			),
		);
		const large = {
			...project,
			projectId: "large",
			config,
		};
		const query = GraphQuerySchema.parse({
			kind: "traverse",
			from: "item:item-0",
			maxDepth: 12,
			maxExpansions: 20,
			limit: 10,
			timeoutMs: 5000,
		});
		const result = await requestFn(large, query);
		expect(Buffer.byteLength(chunk.code)).toBeLessThan(1024 * 1024);
		expect(gzipSync(chunk.code).byteLength).toBeLessThan(256 * 1024);
		expect(result.edges).toHaveLength(10);
		expect(result.expansions).toBeLessThanOrEqual(20);
		expect(result.truncated).toBe(true);
		expect(result).toEqual(await Effect.runPromise(graph.queryFx(large, query)));
		expect(await requestFn(large, query)).toEqual(result);
	} finally {
		await worker.terminate();
	}
}, 30_000);
