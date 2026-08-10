import { Effect } from "effect";

import {
	EditorMcpPortSchema,
	type EditorMcpPortAvailability,
} from "../../../electron/contract/editor/EditorMcpPortSchema";
import { EditorMcpProjectContextSchema } from "../../../electron/contract/editor/EditorMcpProjectContextSchema";

export type EditorMcpPort = EditorMcpPortSchema.Type;
export type { EditorMcpPortAvailability };

const updateEditorMcpProjectContextFx = (
	projectIdCandidate: unknown,
	update: (projectId: string) => Promise<void>,
) =>
	Effect.try({
		try: () => EditorMcpProjectContextSchema.parse(projectIdCandidate),
		catch: (cause) => cause,
	}).pipe(
		Effect.flatMap((projectId) =>
			Effect.tryPromise({
				try: () => update(projectId),
				catch: (cause) => cause,
			}),
		),
	);

export const setEditorMcpProjectContextFx = (projectId: unknown) =>
	updateEditorMcpProjectContextFx(projectId, window.arkini.editorMcp.setProjectContext);

export const clearEditorMcpProjectContextFx = (projectId: unknown) =>
	updateEditorMcpProjectContextFx(projectId, window.arkini.editorMcp.clearProjectContext);

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
