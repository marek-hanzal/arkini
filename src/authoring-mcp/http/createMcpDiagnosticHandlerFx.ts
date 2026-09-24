import type { McpHttpHandler, McpHandlerRequestOptions } from "@modelcontextprotocol/server";
import { Clock, Effect } from "effect";

const MAX_CAPTURE_BYTES = 256 * 1024;
const MAX_DETAIL_LENGTH = 16 * 1024;
const graphTools = new Set([
	"graph_search",
	"graph_connections",
	"graph_operations",
	"graph_path",
	"graph_flow",
	"graph_traverse",
	"graph_batch",
	"graph_operations_json",
	"graph_schema_json",
]);
const graphArgumentKeys = new Set([
	"kind",
	"from",
	"to",
	"direction",
	"kinds",
	"nodeKinds",
	"operationKinds",
	"search",
	"text",
	"scope",
	"filter",
	"aggregate",
	"mode",
	"by",
	"hasOutcomes",
	"action",
	"effect",
	"ownership",
	"clock",
	"default",
	"show",
	"enable",
	"runtimeMs",
	"clockWeight",
	"durationMs",
	"intervalMs",
	"min",
	"max",
	"gt",
	"lt",
	"owner",
	"participant",
	"role",
	"maxDepth",
	"limit",
	"maxExpansions",
	"timeoutMs",
	"revision",
	"snapshotId",
	"cursor",
	"queries",
	"id",
	"query",
	"operationIds",
	"itemUid",
]);

const boundedValueFn = (value: unknown, depth = 0): unknown => {
	if (typeof value === "string") return value.slice(0, 8192);
	if (value === null || typeof value !== "object") return value;
	if (depth >= 6) return "<depth limit>";
	if (Array.isArray(value))
		return value.slice(0, 64).map((entry) => boundedValueFn(entry, depth + 1));
	return Object.fromEntries(
		Object.entries(value)
			.slice(0, 64)
			.map(([key, entry]) => [
				key.slice(0, 100),
				graphArgumentKeys.has(key) ? boundedValueFn(entry, depth + 1) : "<omitted>",
			]),
	);
};

const objectFn = (value: unknown): Record<string, unknown> | undefined =>
	value !== null && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: undefined;

// A clone is observed only up to the cap; cancelling its branch never consumes the caller's stream.
const readBoundedBodyFx = Effect.fn("readBoundedBodyFx")(
	(body: ReadableStream<Uint8Array> | null, signal: AbortSignal) =>
		Effect.tryPromise({
			try: async (effectSignal) => {
				const readSignal = AbortSignal.any([
					signal,
					effectSignal,
				]);
				if (body === null) return "";
				const reader = body.getReader();
				const cancelFn = () => {
					void reader.cancel().catch(() => undefined);
				};
				if (readSignal.aborted) cancelFn();
				else
					readSignal.addEventListener("abort", cancelFn, {
						once: true,
					});
				const decoder = new TextDecoder();
				let bytes = 0;
				let text = "";
				try {
					while (true) {
						const chunk = await reader.read();
						if (readSignal.aborted) throw new Error("MCP observation aborted");
						if (chunk.done) return text + decoder.decode();
						bytes += chunk.value.byteLength;
						if (bytes > MAX_CAPTURE_BYTES) {
							void reader.cancel().catch(() => undefined);
							return undefined;
						}
						text += decoder.decode(chunk.value, {
							stream: true,
						});
					}
				} finally {
					readSignal.removeEventListener("abort", cancelFn);
					reader.releaseLock();
				}
			},
			catch: (cause) => cause,
		}),
);

const parseJsonFn = (text: string): unknown => {
	try {
		return JSON.parse(text) as unknown;
	} catch {
		return undefined;
	}
};

const responseSummaryFn = (text: string | undefined, eventStream: boolean, graph: boolean) => {
	if (text === undefined)
		return {
			outcome: "response exceeds diagnostic limit",
			detail: "",
		};
	const values = eventStream
		? text.split(/\r?\n\r?\n/u).flatMap((event) => {
				const data = event
					.split(/\r?\n/u)
					.filter((line) => line.startsWith("data:"))
					.map((line) => line.slice(5).trimStart())
					.join("\n");
				return data === ""
					? []
					: [
							parseJsonFn(data),
						];
			})
		: [
				parseJsonFn(text),
			];
	const messages = values
		.map(objectFn)
		.filter((message) => message?.result !== undefined || message?.error !== undefined);
	if (messages.length === 0)
		return {
			outcome: "response could not be decoded",
			detail: "",
		};
	const failed = messages.some(
		(message) => message?.error !== undefined || objectFn(message?.result)?.isError === true,
	);
	const details: string[] = [];
	for (const message of messages) {
		const error = objectFn(message?.error);
		if (typeof error?.message === "string")
			details.push(`Protocol error ${String(error.code)}: ${error.message}`);
		if (!graph) continue;
		const result = objectFn(message?.result);
		if (!Array.isArray(result?.content)) continue;
		for (const entry of result.content) {
			const content = objectFn(entry);
			if (content?.type !== "text" || typeof content.text !== "string") continue;
			if (result.isError === true) details.push(content.text);
			else
				details.push(
					...content.text
						.split("\n")
						.filter((line) =>
							/^(Project:|Revision:|Snapshot:|Query:|Status:|Reasons:|Error:)/u.test(
								line,
							),
						),
				);
		}
	}
	return {
		outcome: failed ? "tool error" : "completed",
		detail: details.join("\n").slice(0, MAX_DETAIL_LENGTH),
	};
};

export namespace createMcpDiagnosticHandlerFx {
	export interface Record {
		readonly level: "info" | "warning" | "error";
		readonly message: string;
		readonly body: string;
	}

	export interface Props {
		readonly handler: McpHttpHandler;
		readonly readProjectContextFn: () => string | undefined;
		readonly writeMcpLogFx: (
			record: createMcpDiagnosticHandlerFx.Record,
		) => Effect.Effect<void, unknown, never>;
		readonly runPromiseFn: <Value, Error>(
			effect: Effect.Effect<Value, Error, never>,
		) => Promise<Value>;
	}
}

/** Observes the wire boundary so SDK admission failures are recorded before tool callbacks can run. */
export const createMcpDiagnosticHandlerFx = Effect.fn("createMcpDiagnosticHandlerFx")(function* ({
	handler,
	readProjectContextFn,
	writeMcpLogFx,
	runPromiseFn,
}: createMcpDiagnosticHandlerFx.Props) {
	const clock = yield* Clock.Clock;
	let sequence = 0;
	const lifetime = new AbortController();
	const writeFn = async (record: createMcpDiagnosticHandlerFx.Record) => {
		try {
			await runPromiseFn(writeMcpLogFx(record));
		} catch {
			/* Logging cannot reject a tool call. */
		}
	};
	return {
		...handler,
		close: async () => {
			lifetime.abort();
			await handler.close();
		},
		fetch: async (request: Request, options?: McpHandlerRequestOptions) => {
			if (request.method !== "POST") return handler.fetch(request, options);
			const observationSignal = AbortSignal.any([
				lifetime.signal,
				request.signal,
			]);
			let body: Record<string, unknown> | undefined;
			try {
				const text = await runPromiseFn(
					readBoundedBodyFx(request.clone().body, observationSignal),
				);
				if (text !== undefined) body = objectFn(JSON.parse(text));
			} catch {
				/* Diagnostics never replace protocol parsing or its rejection. */
			}
			const params = objectFn(body?.params);
			if (body?.method !== "tools/call" || typeof params?.name !== "string")
				return handler.fetch(request, options);
			const tool = params.name;
			const graph = graphTools.has(tool);
			const startedAt = clock.currentTimeMillisUnsafe();
			const call = `${startedAt}-${++sequence}`;
			const context = `Call: ${call}\nRequest ID: ${JSON.stringify(body.id)?.slice(0, 256)}\nProject: ${JSON.stringify(readProjectContextFn())}\nTool: ${JSON.stringify(tool.slice(0, 160))}`;
			await writeFn({
				level: "info",
				message: "Editor MCP tool started",
				body: `${context}\nArguments: ${graph ? (JSON.stringify(boundedValueFn(params.arguments)) ?? "{}").slice(0, MAX_DETAIL_LENGTH) : "<omitted>"}`,
			});
			try {
				const response = await handler.fetch(request, options);
				void runPromiseFn(readBoundedBodyFx(response.clone().body, observationSignal))
					.then(async (text) => {
						const summary = responseSummaryFn(
							text,
							response.headers.get("content-type")?.includes("text/event-stream") ===
								true,
							graph,
						);
						await writeFn({
							level:
								summary.outcome === "tool error" || !response.ok
									? "warning"
									: "info",
							message: "Editor MCP tool completed",
							body: `${context}\nHTTP: ${response.status}\nDuration ms: ${clock.currentTimeMillisUnsafe() - startedAt}\nOutcome: ${summary.outcome}\n${summary.detail}`,
						});
					})
					.catch(() =>
						writeFn({
							level: "warning",
							message: "Editor MCP response observation failed",
							body: context,
						}),
					);
				return response;
			} catch (cause) {
				await writeFn({
					level: "error",
					message: "Editor MCP transport failed",
					body: `${context}\nDuration ms: ${clock.currentTimeMillisUnsafe() - startedAt}\n${graph && cause instanceof Error ? cause.message.slice(0, MAX_DETAIL_LENGTH) : "Transport failure"}`,
				});
				throw cause;
			}
		},
	} satisfies McpHttpHandler;
});
