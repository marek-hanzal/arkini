import { ipcMain, type IpcMainInvokeEvent } from "electron";
import { Effect } from "effect";
import { z } from "zod";

import { ArkiniElectronApi } from "~electron/contract/ArkiniElectronApi";
import { ElectronMainRuntime } from "~electron/main/ElectronMainRuntime";
import { NonNegativeIntegerSchema } from "~/game-value/schema/NonNegativeIntegerSchema";
import { TilePaintingDocumentSchema } from "~/tile-painting/schema/TilePaintingDocumentSchema";
import { IdSchema } from "~/game-value/schema/IdSchema";
import type { TrustedRenderer } from "~electron/main/security/TrustedRenderer";
import type { DiagnosticLog } from "../../diagnostics/createDiagnosticLogFx";
import type { EditorProjectServiceOwnership } from "~/project-authoring/service/EditorProjectServiceOwnership";
import { executeEditorProjectRepositoryFx } from "./executeEditorProjectRepositoryFx";
import { parseEditorProjectIpcRequestFx } from "./parseEditorProjectIpcRequestFx";

const keySchema = z
	.object({
		projectId: IdSchema,
		paintingId: IdSchema,
	})
	.strict();
const deleteSchema = keySchema
	.extend({
		expectedRevision: NonNegativeIntegerSchema,
		expectedUpdatedAtMs: NonNegativeIntegerSchema,
	})
	.strict();
const saveSchema = deleteSchema
	.extend({
		expectedUpdatedAtMs: NonNegativeIntegerSchema.nullable(),
		document: TilePaintingDocumentSchema,
		bakedPng: z
			.string()
			.max(24 * 1024 * 1024)
			.optional(),
		outputResourceId: IdSchema.optional(),
	})
	.strict();

const batchSchema = z
	.object({
		projectId: IdSchema,
		expectedRevision: NonNegativeIntegerSchema,
		paintings: z
			.array(
				z
					.object({
						paintingId: IdSchema,
						expectedUpdatedAtMs: NonNegativeIntegerSchema,
						document: TilePaintingDocumentSchema,
						bakedPng: z.string().max(24 * 1024 * 1024),
					})
					.strict(),
			)
			.min(1)
			.max(256),
	})
	.strict();

export namespace registerEditorTilePaintingIpcFx {
	export interface Props {
		readonly diagnostics: DiagnosticLog;
		readonly ownership: EditorProjectServiceOwnership;
		readonly trustedRenderer: TrustedRenderer;
	}
}

/** Registers tile-painting IPC over the canonical editor-project repository. */
export const registerEditorTilePaintingIpcFx = Effect.fn("registerEditorTilePaintingIpcFx")(
	({ diagnostics, ownership, trustedRenderer }: registerEditorTilePaintingIpcFx.Props) =>
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

			handleFn(ArkiniElectronApi.channels.editorTilePaintingBake, (candidate) =>
				executeEditorProjectRepositoryFx(
					"bake-tile-paintings",
					ownership,
					diagnostics,
					parseEditorProjectIpcRequestFx("bake-tile-paintings", batchSchema, candidate),
					(repository, request) => repository.bakeTilePaintingsFx(request),
				),
			);
			handleFn(ArkiniElectronApi.channels.editorTilePaintingList, (candidate) =>
				executeEditorProjectRepositoryFx(
					"list-tile-paintings",
					ownership,
					diagnostics,
					parseEditorProjectIpcRequestFx("list-tile-paintings", IdSchema, candidate),
					(repository, projectId) => repository.listTilePaintingsFx(projectId),
				),
			);
			handleFn(ArkiniElectronApi.channels.editorTilePaintingRead, (candidate) =>
				executeEditorProjectRepositoryFx(
					"read-tile-painting",
					ownership,
					diagnostics,
					parseEditorProjectIpcRequestFx("read-tile-painting", keySchema, candidate),
					(repository, request) => repository.readTilePaintingFx(request),
				),
			);
			handleFn(ArkiniElectronApi.channels.editorTilePaintingSave, (candidate) =>
				executeEditorProjectRepositoryFx(
					"save-tile-painting",
					ownership,
					diagnostics,
					parseEditorProjectIpcRequestFx("save-tile-painting", saveSchema, candidate),
					(repository, request) => repository.saveTilePaintingFx(request),
				),
			);
			handleFn(ArkiniElectronApi.channels.editorTilePaintingDelete, (candidate) =>
				executeEditorProjectRepositoryFx(
					"delete-tile-painting",
					ownership,
					diagnostics,
					parseEditorProjectIpcRequestFx("delete-tile-painting", deleteSchema, candidate),
					(repository, request) => repository.deleteTilePaintingFx(request),
				),
			);

			return [
				ArkiniElectronApi.channels.editorTilePaintingBake,
				ArkiniElectronApi.channels.editorTilePaintingList,
				ArkiniElectronApi.channels.editorTilePaintingRead,
				ArkiniElectronApi.channels.editorTilePaintingSave,
				ArkiniElectronApi.channels.editorTilePaintingDelete,
			];
		}),
);
