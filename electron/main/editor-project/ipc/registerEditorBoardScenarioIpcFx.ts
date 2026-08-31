import { ipcMain, type IpcMainInvokeEvent } from "electron";
import { Effect } from "effect";
import { z } from "zod";

import { ArkiniElectronApi } from "../../../contract/ArkiniElectronApi";

import { ElectronMainRuntime } from "../../ElectronMainRuntime";
import { BoardScenarioNameSchema } from "~/board-scenario/schema/BoardScenarioSchema";
import { IdSchema } from "~/game-config/schema/IdSchema";
import type { TrustedRenderer } from "../../security/TrustedRenderer";
import type { EditorProjectServiceOwnership } from "../EditorProjectServiceOwnership";
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
		readonly ownership: EditorProjectServiceOwnership;
		readonly trustedRenderer: TrustedRenderer;
	}
}

/** Registers Board-scenario IPC over the canonical editor-project repository. */
export const registerEditorBoardScenarioIpcFx = Effect.fn("registerEditorBoardScenarioIpcFx")(
	({ ownership, trustedRenderer }: registerEditorBoardScenarioIpcFx.Props) =>
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

			handle(ArkiniElectronApi.channels.editorBoardScenarioList, (candidate) =>
				executeEditorProjectRepositoryFx(
					"list-board-scenarios",
					ownership,
					parseEditorProjectIpcRequestFx("list-board-scenarios", IdSchema, candidate),
					(repository, projectId) => repository.listBoardScenariosFx(projectId),
				),
			);
			handle(ArkiniElectronApi.channels.editorBoardScenarioRead, (candidate) =>
				executeEditorProjectRepositoryFx(
					"read-board-scenario",
					ownership,
					parseEditorProjectIpcRequestFx(
						"read-board-scenario",
						boardScenarioKeySchema,
						candidate,
					),
					(repository, request) => repository.readBoardScenarioFx(request),
				),
			);
			handle(ArkiniElectronApi.channels.editorBoardScenarioWrite, (candidate) =>
				executeEditorProjectRepositoryFx(
					"write-board-scenario",
					ownership,
					parseEditorProjectIpcRequestFx(
						"write-board-scenario",
						writeBoardScenarioSchema,
						candidate,
					),
					(repository, request) => repository.writeBoardScenarioFx(request),
				),
			);
			handle(ArkiniElectronApi.channels.editorBoardScenarioDelete, (candidate) =>
				executeEditorProjectRepositoryFx(
					"delete-board-scenario",
					ownership,
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
