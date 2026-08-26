import { Buffer } from "node:buffer";
import { Clock, FileSystem, Path } from "effect";
import { Effect, type Semaphore } from "effect";

import type { FilesystemEditorProjectState } from "../FilesystemEditorProjectState";
import type { EditorProjectRepositoryService } from "~/editor/EditorProjectRepository";
import { EditorProjectRepositoryError } from "~/editor/EditorProjectRepositoryError";
import { EditorBoardScenarioFileSchema } from "~/editor/filesystem/EditorBoardScenarioFileSchema";
import {
	EditorBoardScenarioNameSchema,
	EditorBoardScenarioSchema,
} from "~/editor/board/EditorBoardScenarioSchema";
import { replaceFilesystemEditorJsonFx } from "./replaceFilesystemEditorJsonFx";
import { withFilesystemEditorProjectLockFx } from "./withFilesystemEditorProjectLockFx";

type Operations = Pick<
	EditorProjectRepositoryService,
	| "listBoardScenariosFx"
	| "readBoardScenarioFx"
	| "writeBoardScenarioFx"
	| "deleteBoardScenarioFx"
>;

type Operation =
	| "list-board-scenarios"
	| "read-board-scenario"
	| "write-board-scenario"
	| "delete-board-scenario";

const error = (operation: Operation, message: string, cause?: unknown) =>
	cause instanceof EditorProjectRepositoryError && cause.operation === operation
		? cause
		: new EditorProjectRepositoryError({
				operation,
				message,
				cause,
			});

export namespace createFilesystemEditorBoardScenarioOperationsFx {
	export interface Props {
		readonly operations: Semaphore.Semaphore;
		readonly readState: (
			projectId: string,
		) => Effect.Effect<FilesystemEditorProjectState, EditorProjectRepositoryError>;
		readonly states: Map<string, FilesystemEditorProjectState>;
	}
}

/** Stores each named authored Board scenario as one portable JSON envelope. */
export const createFilesystemEditorBoardScenarioOperationsFx = Effect.fn(
	"createFilesystemEditorBoardScenarioOperationsFx",
)(function* ({
	operations,
	readState,
	states,
}: createFilesystemEditorBoardScenarioOperationsFx.Props) {
	const fileSystem = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const replaceJsonFx = (target: string, value: unknown) =>
		replaceFilesystemEditorJsonFx(target, value).pipe(
			Effect.provideService(FileSystem.FileSystem, fileSystem),
			Effect.provideService(Path.Path, path),
		);

	const readScenariosFx = (projectId: string) =>
		readState(projectId).pipe(
			Effect.map((state) =>
				state.scenarios.map((scenario) => ({
					...scenario,
					bytes: scenario.bytes.slice(),
				})),
			),
		);
	const publishScenarios = (
		state: FilesystemEditorProjectState,
		scenarios: ReadonlyArray<EditorBoardScenarioSchema.Type>,
	) =>
		states.set(state.project.projectId, {
			...state,
			scenarios: [
				...scenarios,
			]
				.sort(
					(left, right) =>
						right.updatedAtMs - left.updatedAtMs || left.name.localeCompare(right.name),
				)
				.map((scenario) => ({
					...scenario,
					bytes: scenario.bytes.slice(),
				})),
		});

	const listBoardScenariosFx: Operations["listBoardScenariosFx"] = (projectId) =>
		operations.withPermits(1)(
			readScenariosFx(projectId).pipe(
				Effect.map((scenarios) =>
					scenarios
						.sort(
							(left, right) =>
								right.updatedAtMs - left.updatedAtMs ||
								left.name.localeCompare(right.name),
						)
						.map(({ bytes: _bytes, ...descriptor }) => descriptor),
				),
				Effect.mapError((cause) =>
					error(
						"list-board-scenarios",
						`Board scenarios for project ${projectId} could not be listed.`,
						cause,
					),
				),
			),
		);

	const readBoardScenarioFx: Operations["readBoardScenarioFx"] = ({ projectId, name }) =>
		operations.withPermits(1)(
			readScenariosFx(projectId).pipe(
				Effect.map(
					(scenarios) => scenarios.find((scenario) => scenario.name === name) ?? null,
				),
				Effect.mapError((cause) =>
					error(
						"read-board-scenario",
						`Board scenario ${name} in project ${projectId} could not be read.`,
						cause,
					),
				),
			),
		);

	const writeBoardScenarioFx: Operations["writeBoardScenarioFx"] = ({
		projectId,
		expectedRevision,
		name: candidateName,
		bytes: candidateBytes,
	}) =>
		Effect.gen(function* () {
			const { name, bytes } = yield* Effect.try({
				try: () => ({
					name: EditorBoardScenarioNameSchema.parse(candidateName),
					bytes: new Uint8Array(candidateBytes),
				}),
				catch: (cause) =>
					error("write-board-scenario", "The Editor Board scenario is invalid.", cause),
			});
			if (bytes.byteLength === 0)
				return yield* Effect.fail(
					error("write-board-scenario", "The Editor Board scenario is empty."),
				);
			const clockMs = yield* Clock.currentTimeMillis;
			return yield* operations.withPermits(1)(
				Effect.gen(function* () {
					const state = yield* readState(projectId);
					if (state.project.revision !== expectedRevision)
						return yield* Effect.fail(
							error(
								"write-board-scenario",
								`Editor project ${projectId} changed from revision ${expectedRevision} to ${state.project.revision} before this write could commit.`,
							),
						);
					const scenarios = yield* readScenariosFx(projectId);
					const previous = scenarios.find((scenario) => scenario.name === name);
					const written = EditorBoardScenarioSchema.parse({
						projectId,
						name,
						projectRevision: state.project.revision,
						version: state.project.version,
						bytes,
						createdAtMs: previous?.createdAtMs ?? clockMs,
						updatedAtMs: Math.max(clockMs, (previous?.updatedAtMs ?? clockMs - 1) + 1),
					});
					const target = yield* state.paths.scenarioFileFx(name);
					yield* withFilesystemEditorProjectLockFx(
						state.paths.root,
						replaceJsonFx(
							target,
							EditorBoardScenarioFileSchema.parse({
								name: written.name,
								revision: written.projectRevision,
								version: written.version,
								save: Buffer.from(written.bytes).toString("base64"),
								createdAtMs: written.createdAtMs,
								updatedAtMs: written.updatedAtMs,
							}),
						),
					);
					publishScenarios(state, [
						written,
						...scenarios.filter((scenario) => scenario.name !== name),
					]);
					return written;
				}),
			);
		}).pipe(
			Effect.mapError((cause) =>
				error(
					"write-board-scenario",
					`Board scenario ${candidateName} could not be saved in project ${projectId}.`,
					cause,
				),
			),
		);

	const deleteBoardScenarioFx: Operations["deleteBoardScenarioFx"] = ({ projectId, name }) =>
		operations.withPermits(1)(
			Effect.gen(function* () {
				const state = yield* readState(projectId);
				const target = yield* state.paths.scenarioFileFx(name);
				yield* withFilesystemEditorProjectLockFx(
					state.paths.root,
					fileSystem.remove(target, {
						force: true,
					}),
				);
				publishScenarios(
					state,
					state.scenarios.filter((scenario) => scenario.name !== name),
				);
			}).pipe(
				Effect.mapError((cause) =>
					error(
						"delete-board-scenario",
						`Board scenario ${name} could not be deleted from project ${projectId}.`,
						cause,
					),
				),
			),
		);

	return {
		listBoardScenariosFx,
		readBoardScenarioFx,
		writeBoardScenarioFx,
		deleteBoardScenarioFx,
	} satisfies Operations;
});
