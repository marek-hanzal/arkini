import { ipcMain, type IpcMainInvokeEvent } from "electron";
import { Effect } from "effect";
import { z } from "zod";

import { ArkiniElectronApi } from "~electron/contract/ArkiniElectronApi";

import { ElectronMainRuntime } from "~electron/main/ElectronMainRuntime";
import { BoardScenarioNameSchema } from "~/board-scenario/schema/BoardScenarioSchema";
import { IdSchema } from "~/game-value/schema/IdSchema";
import type { TrustedRenderer } from "~electron/main/security/TrustedRenderer";
import type { DiagnosticLog } from "../../diagnostics/createDiagnosticLogFx";
import type { EditorProjectServiceOwnership } from "~/project-authoring/service/EditorProjectServiceOwnership";
import { executeEditorProjectRepositoryFx } from "./executeEditorProjectRepositoryFx";
import { parseEditorProjectIpcRequestFx } from "./parseEditorProjectIpcRequestFx";

const boardScenarioKeySchema = z
	.object({
		projectId: IdSchema,
		name: BoardScenarioNameSchema,
	})
	.strict();
const writeBoardScenarioSchema = boardScenarioKeySchema
	.extend({
		expectedRevision: z.number().int().nonnegative(),
		bytes: z.instanceof(Uint8Array).refine((bytes) => bytes.byteLength > 0),
	})
	.strict();

export namespace registerEditorBoardScenarioIpcFx {
	export interface Props {
		readonly diagnostics: DiagnosticLog;
		readonly ownership: EditorProjectServiceOwnership;
		readonly trustedRenderer: TrustedRenderer;
	}
}

/** Registers Board-scenario IPC over the canonical editor-project repository. */
export const registerEditorBoardScenarioIpcFx = Effect.fn("registerEditorBoardScenarioIpcFx")(
	({ diagnostics, ownership, trustedRenderer }: registerEditorBoardScenarioIpcFx.Props) =>
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

			handleFn(ArkiniElectronApi.channels.editorBoardScenarioList, (candidate) =>
				executeEditorProjectRepositoryFx(
					"list-board-scenarios",
					ownership,
					diagnostics,
					parseEditorProjectIpcRequestFx("list-board-scenarios", IdSchema, candidate),
					(repository, projectId) => repository.listBoardScenariosFx(projectId),
				),
			);
			handleFn(ArkiniElectronApi.channels.editorBoardScenarioRead, (candidate) =>
				executeEditorProjectRepositoryFx(
					"read-board-scenario",
					ownership,
					diagnostics,
					parseEditorProjectIpcRequestFx(
						"read-board-scenario",
						boardScenarioKeySchema,
						candidate,
					),
					(repository, request) => repository.readBoardScenarioFx(request),
				),
			);
			handleFn(ArkiniElectronApi.channels.editorBoardScenarioWrite, (candidate) =>
				executeEditorProjectRepositoryFx(
					"write-board-scenario",
					ownership,
					diagnostics,
					parseEditorProjectIpcRequestFx(
						"write-board-scenario",
						writeBoardScenarioSchema,
						candidate,
					),
					(repository, request) => repository.writeBoardScenarioFx(request),
				),
			);
			handleFn(ArkiniElectronApi.channels.editorBoardScenarioDelete, (candidate) =>
				executeEditorProjectRepositoryFx(
					"delete-board-scenario",
					ownership,
					diagnostics,
					parseEditorProjectIpcRequestFx(
						"delete-board-scenario",
						boardScenarioKeySchema,
						candidate,
					),
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
		}),
);
