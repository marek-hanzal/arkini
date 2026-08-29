import { ipcMain, type IpcMainInvokeEvent } from "electron";
import { Effect } from "effect";
import { z } from "zod";

import { ArkiniElectronApi } from "../../../contract/ArkiniElectronApi";
import { ElectronMainRuntime } from "../../ElectronMainRuntime";
import { EditorNoteContentSchema } from "~/editor/note/EditorNoteSchema";
import { IdSchema } from "~/engine/common/schema/IdSchema";
import type { TrustedRenderer } from "../../security/TrustedRenderer";
import type { EditorProjectServiceOwnership } from "../EditorProjectServiceOwnership";
import { executeEditorProjectRepositoryFx } from "./executeEditorProjectRepositoryFx";
import { parseEditorProjectIpcRequestFx } from "./parseEditorProjectIpcRequestFx";

const createNoteSchema = z
	.object({
		projectId: IdSchema,
		content: EditorNoteContentSchema,
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
		content: EditorNoteContentSchema,
	})
	.strict();

export namespace registerEditorNoteIpcFx {
	export interface Props {
		readonly ownership: EditorProjectServiceOwnership;
		readonly trustedRenderer: TrustedRenderer;
	}
}

/** Registers project-note IPC over the canonical editor-project repository. */
export const registerEditorNoteIpcFx = Effect.fn("registerEditorNoteIpcFx")(
	({ ownership, trustedRenderer }: registerEditorNoteIpcFx.Props) =>
		Effect.sync(() => {
			const handle = <Value>(
				channel: string,
				run: (candidate: unknown) => Effect.Effect<Value>,
			) =>
				ipcMain.handle(channel, (event: IpcMainInvokeEvent, candidate) =>
					ElectronMainRuntime.runPromise(
						trustedRenderer
							.assertTrustedIpcSenderFx(event)
							.pipe(Effect.andThen(run(candidate))),
					),
				);

			handle(ArkiniElectronApi.channels.editorNoteList, (candidate) =>
				executeEditorProjectRepositoryFx(
					"list-notes",
					ownership,
					parseEditorProjectIpcRequestFx("list-notes", IdSchema, candidate),
					(repository, projectId) => repository.listNotesFx(projectId),
				),
			);
			handle(ArkiniElectronApi.channels.editorNoteCreate, (candidate) =>
				executeEditorProjectRepositoryFx(
					"create-note",
					ownership,
					parseEditorProjectIpcRequestFx("create-note", createNoteSchema, candidate),
					(repository, request) => repository.createNoteFx(request),
				),
			);
			handle(ArkiniElectronApi.channels.editorNoteUpdate, (candidate) =>
				executeEditorProjectRepositoryFx(
					"update-note",
					ownership,
					parseEditorProjectIpcRequestFx("update-note", updateNoteSchema, candidate),
					(repository, request) => repository.updateNoteFx(request),
				),
			);
			handle(ArkiniElectronApi.channels.editorNoteDelete, (candidate) =>
				executeEditorProjectRepositoryFx(
					"delete-note",
					ownership,
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
