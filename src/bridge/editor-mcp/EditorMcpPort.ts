import { Effect } from "effect";

import {
	EditorMcpPortSchema,
	type EditorMcpPortAvailability,
} from "../../../electron/contract/editor/EditorMcpPortSchema";

export type EditorMcpPort = EditorMcpPortSchema.Type;
export type { EditorMcpPortAvailability };

/** Lazily starts MCP on first editor entry; MCP failure never blocks the editor UI. */
export const activateEditorMcpFx = Effect.tryPromise({
	try: () => window.arkini.editorMcp.activate(),
	catch: (cause) => cause,
}).pipe(
	Effect.catch(() =>
		Effect.succeed({
			type: "unavailable" as const,
			message: "The editor MCP service did not respond.",
		}),
	),
);

export const readEditorMcpPortFx = () =>
	Effect.tryPromise({
		try: () => window.arkini.editorMcp.readPort(),
		catch: (cause) => cause,
	}).pipe(Effect.map(EditorMcpPortSchema.parse));

export const checkEditorMcpPortFx = (candidate: unknown) =>
	Effect.try({
		try: () => EditorMcpPortSchema.parse(candidate),
		catch: (cause) => cause,
	}).pipe(
		Effect.flatMap((port) =>
			Effect.tryPromise({
				try: () => window.arkini.editorMcp.checkPort(port),
				catch: (cause) => cause,
			}),
		),
	);

export const writeEditorMcpPortFx = (candidate: unknown) =>
	Effect.try({
		try: () => EditorMcpPortSchema.parse(candidate),
		catch: (cause) => cause,
	}).pipe(
		Effect.flatMap((port) =>
			Effect.tryPromise({
				try: () => window.arkini.editorMcp.writePort(port),
				catch: (cause) => cause,
			}),
		),
	);
