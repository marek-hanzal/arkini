import { ipcMain, type IpcMainInvokeEvent } from "electron";
import { Effect } from "effect";

import { ArkiniElectronApi } from "../../../contract/ArkiniElectronApi";

import { ElectronMainRuntime } from "../../ElectronMainRuntime";
import type { TrustedRenderer } from "../../security/TrustedRenderer";
import type { EditorProjectServiceOwnership } from "../EditorProjectServiceOwnership";
import { createEditorBoardScenarioRequestParserFx } from "./createEditorBoardScenarioRequestParserFx";
import { executeEditorProjectRepositoryFx } from "./executeEditorProjectRepositoryFx";

export namespace registerEditorBoardScenarioIpcFx {
	export interface Props {
		readonly ownership: EditorProjectServiceOwnership;
		readonly trustedRenderer: TrustedRenderer;
	}
}

/** Registers Board-scenario IPC over the canonical editor-project repository. */
export const registerEditorBoardScenarioIpcFx = Effect.fn("registerEditorBoardScenarioIpcFx")(
	({ ownership, trustedRenderer }: registerEditorBoardScenarioIpcFx.Props) =>
		Effect.gen(function* () {
			const requestParser = yield* createEditorBoardScenarioRequestParserFx();
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

				handle(ArkiniElectronApi.channels.editorBoardScenarioList, (candidate) =>
					executeEditorProjectRepositoryFx(
						"list-board-scenarios",
						ownership,
						requestParser.parseProjectIdFx(candidate),
						(repository, projectId) => repository.listBoardScenariosFx(projectId),
					),
				);
				handle(ArkiniElectronApi.channels.editorBoardScenarioRead, (candidate) =>
					executeEditorProjectRepositoryFx(
						"read-board-scenario",
						ownership,
						requestParser.parseReadKeyFx(candidate),
						(repository, request) => repository.readBoardScenarioFx(request),
					),
				);
				handle(ArkiniElectronApi.channels.editorBoardScenarioWrite, (candidate) =>
					executeEditorProjectRepositoryFx(
						"write-board-scenario",
						ownership,
						requestParser.parseWriteFx(candidate),
						(repository, request) => repository.writeBoardScenarioFx(request),
					),
				);
				handle(ArkiniElectronApi.channels.editorBoardScenarioDelete, (candidate) =>
					executeEditorProjectRepositoryFx(
						"delete-board-scenario",
						ownership,
						requestParser.parseDeleteKeyFx(candidate),
						(repository, request) => repository.deleteBoardScenarioFx(request),
					),
				);

				const channels = [
					ArkiniElectronApi.channels.editorBoardScenarioList,
					ArkiniElectronApi.channels.editorBoardScenarioRead,
					ArkiniElectronApi.channels.editorBoardScenarioWrite,
					ArkiniElectronApi.channels.editorBoardScenarioDelete,
				];
				return channels;
			});
		}),
);
