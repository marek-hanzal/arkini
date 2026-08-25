import { ipcMain, type IpcMainInvokeEvent } from "electron";
import { Effect } from "effect";

import { ArkiniElectronApi } from "../../../contract/ArkiniElectronApi";
import { ElectronMainRuntime } from "../../ElectronMainRuntime";
import type { TrustedRenderer } from "../../security/TrustedRenderer";
import type { EditorProjectServiceOwnership } from "../EditorProjectServiceOwnership";
import { createEditorNoteRequestParserFx } from "./createEditorNoteRequestParserFx";
import { executeEditorProjectRepositoryFx } from "./executeEditorProjectRepositoryFx";

export namespace registerEditorNoteIpcFx {
	export interface Props {
		readonly ownership: EditorProjectServiceOwnership;
		readonly trustedRenderer: TrustedRenderer;
	}
}

/** Registers project-note IPC over the canonical editor-project repository. */
export const registerEditorNoteIpcFx = Effect.fn("registerEditorNoteIpcFx")(
	({ ownership, trustedRenderer }: registerEditorNoteIpcFx.Props) =>
		Effect.gen(function* () {
			const requestParser = yield* createEditorNoteRequestParserFx();
			return yield* Effect.sync(() => {
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
						requestParser.parseProjectIdFx(candidate),
						(repository, projectId) => repository.listNotesFx(projectId),
					),
				);
				handle(ArkiniElectronApi.channels.editorNoteCreate, (candidate) =>
					executeEditorProjectRepositoryFx(
						"create-note",
						ownership,
						requestParser.parseCreateFx(candidate),
						(repository, request) => repository.createNoteFx(request),
					),
				);
				handle(ArkiniElectronApi.channels.editorNoteUpdate, (candidate) =>
					executeEditorProjectRepositoryFx(
						"update-note",
						ownership,
						requestParser.parseUpdateFx(candidate),
						(repository, request) => repository.updateNoteFx(request),
					),
				);
				handle(ArkiniElectronApi.channels.editorNoteDelete, (candidate) =>
					executeEditorProjectRepositoryFx(
						"delete-note",
						ownership,
						requestParser.parseDeleteFx(candidate),
						(repository, request) => repository.deleteNoteFx(request),
					),
				);

				return [
					ArkiniElectronApi.channels.editorNoteList,
					ArkiniElectronApi.channels.editorNoteCreate,
					ArkiniElectronApi.channels.editorNoteUpdate,
					ArkiniElectronApi.channels.editorNoteDelete,
				];
			});
		}),
);
