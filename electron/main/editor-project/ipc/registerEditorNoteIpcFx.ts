import { ipcMain, type IpcMainInvokeEvent } from "electron";
import { Effect } from "effect";
import { z } from "zod";

import { ArkiniElectronApi } from "~electron/contract/ArkiniElectronApi";
import { ElectronMainRuntime } from "~electron/main/ElectronMainRuntime";
import { NoteContentSchema } from "~/project-note/schema/NoteSchema";
import { IdSchema } from "~/game-config/schema/IdSchema";
import type { TrustedRenderer } from "~electron/main/security/TrustedRenderer";
import type { DiagnosticLog } from "../../diagnostics/createDiagnosticLogFx";
import type { EditorProjectServiceOwnership } from "../EditorProjectServiceOwnership";
import { executeEditorProjectRepositoryFx } from "./executeEditorProjectRepositoryFx";
import { parseEditorProjectIpcRequestFx } from "./parseEditorProjectIpcRequestFx";

const createNoteSchema = z
	.object({
		projectId: IdSchema,
		content: NoteContentSchema,
	})
	.strict();
const noteKeySchema = z
	.object({
		projectId: IdSchema,
		noteId: IdSchema,
	})
	.strict();
const updateNoteSchema = noteKeySchema
	.extend({
		content: NoteContentSchema,
	})
	.strict();

export namespace registerEditorNoteIpcFx {
	export interface Props {
		readonly diagnostics: DiagnosticLog;
		readonly ownership: EditorProjectServiceOwnership;
		readonly trustedRenderer: TrustedRenderer;
	}
}

/** Registers project-note IPC over the canonical editor-project repository. */
export const registerEditorNoteIpcFx = Effect.fn("registerEditorNoteIpcFx")(
	({ diagnostics, ownership, trustedRenderer }: registerEditorNoteIpcFx.Props) =>
		Effect.sync(() => {
			const handleFn = <Value>(
				channel: string,
				runFx: (candidate: unknown) => Effect.Effect<Value, never, never>,
			) =>
				ipcMain.handle(channel, (event: IpcMainInvokeEvent, candidate) =>
					ElectronMainRuntime.runPromise(
						trustedRenderer
							.assertTrustedIpcSenderFx(event)
							.pipe(Effect.andThen(runFx(candidate))),
					),
				);

			handleFn(ArkiniElectronApi.channels.editorNoteList, (candidate) =>
				executeEditorProjectRepositoryFx(
					"list-notes",
					ownership,
					diagnostics,
					parseEditorProjectIpcRequestFx("list-notes", IdSchema, candidate),
					(repository, projectId) => repository.listNotesFx(projectId),
				),
			);
			handleFn(ArkiniElectronApi.channels.editorNoteCreate, (candidate) =>
				executeEditorProjectRepositoryFx(
					"create-note",
					ownership,
					diagnostics,
					parseEditorProjectIpcRequestFx("create-note", createNoteSchema, candidate),
					(repository, request) => repository.createNoteFx(request),
				),
			);
			handleFn(ArkiniElectronApi.channels.editorNoteUpdate, (candidate) =>
				executeEditorProjectRepositoryFx(
					"update-note",
					ownership,
					diagnostics,
					parseEditorProjectIpcRequestFx("update-note", updateNoteSchema, candidate),
					(repository, request) => repository.updateNoteFx(request),
				),
			);
			handleFn(ArkiniElectronApi.channels.editorNoteDelete, (candidate) =>
				executeEditorProjectRepositoryFx(
					"delete-note",
					ownership,
					diagnostics,
					parseEditorProjectIpcRequestFx("delete-note", noteKeySchema, candidate),
					(repository, request) => repository.deleteNoteFx(request),
				),
			);

			return [
				ArkiniElectronApi.channels.editorNoteList,
				ArkiniElectronApi.channels.editorNoteCreate,
				ArkiniElectronApi.channels.editorNoteUpdate,
				ArkiniElectronApi.channels.editorNoteDelete,
			];
		}),
);
