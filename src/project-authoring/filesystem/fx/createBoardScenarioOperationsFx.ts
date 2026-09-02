import { Buffer } from "node:buffer";
import { Clock } from "effect";
import { Effect, type Semaphore } from "effect";

import type { ProjectState } from "../ProjectState";
import type { ProjectRepositoryService } from "~/project-authoring/service/ProjectRepository";
import { ProjectRepositoryError } from "~/project-authoring/error/ProjectRepositoryError";
import { BoardScenarioFileSchema } from "~/board-scenario/schema/BoardScenarioFileSchema";
import {
	BoardScenarioNameSchema,
	BoardScenarioSchema,
} from "~/board-scenario/schema/BoardScenarioSchema";
import type { FilesystemWrite } from "~/filesystem-write/service/FilesystemWrite";
import { withFilesystemWriteRecoveryFn } from "~/filesystem-write/fn/withFilesystemWriteRecoveryFn";
import { withProjectLockFx } from "./withProjectLockFx";

const encoder = new TextEncoder();
const encodeJsonFn = (value: unknown) =>
	encoder.encode(`${JSON.stringify(value, undefined, "\t")}\n`);

type Operations = Pick<
	ProjectRepositoryService,
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

const errorFn = (operation: Operation, message: string, cause?: unknown) =>
	cause instanceof ProjectRepositoryError && cause.operation === operation
		? cause
		: new ProjectRepositoryError({
				operation,
				message: withFilesystemWriteRecoveryFn(message, cause),
				cause,
			});

export namespace createBoardScenarioOperationsFx {
	export interface Props {
		readonly filesystemWrite: FilesystemWrite;
		readonly operations: Semaphore.Semaphore;
		readonly readStateFx: (
			projectId: string,
		) => Effect.Effect<ProjectState, ProjectRepositoryError, never>;
		readonly states: Map<string, ProjectState>;
	}
}

/** Stores each named authored Board scenario as one portable JSON envelope. */
export const createBoardScenarioOperationsFx = Effect.fn("createBoardScenarioOperationsFx")(
	function* ({
		filesystemWrite,
		operations,
		readStateFx,
		states,
	}: createBoardScenarioOperationsFx.Props) {
		const readScenariosFx = (projectId: string) =>
			readStateFx(projectId).pipe(
				Effect.map((state) =>
					state.scenarios.map((scenario) => ({
						...scenario,
						bytes: scenario.bytes.slice(),
					})),
				),
			);
		const publishScenariosFn = (
			state: ProjectState,
			scenarios: ReadonlyArray<BoardScenarioSchema.Type>,
		) =>
			states.set(state.project.projectId, {
				...state,
				scenarios: [
					...scenarios,
				]
					.sort(
						(left, right) =>
							right.updatedAtMs - left.updatedAtMs ||
							left.name.localeCompare(right.name),
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
						errorFn(
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
						errorFn(
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
						name: BoardScenarioNameSchema.parse(candidateName),
						bytes: new Uint8Array(candidateBytes),
					}),
					catch: (cause) =>
						errorFn(
							"write-board-scenario",
							"The Editor Board scenario is invalid.",
							cause,
						),
				});
				if (bytes.byteLength === 0)
					return yield* Effect.fail(
						errorFn("write-board-scenario", "The Editor Board scenario is empty."),
					);
				const clockMs = yield* Clock.currentTimeMillis;
				return yield* operations.withPermits(1)(
					Effect.gen(function* () {
						const state = yield* readStateFx(projectId);
						if (state.project.revision !== expectedRevision)
							return yield* Effect.fail(
								errorFn(
									"write-board-scenario",
									`Editor project ${projectId} changed from revision ${expectedRevision} to ${state.project.revision} before this write could commit.`,
								),
							);
						const scenarios = yield* readScenariosFx(projectId);
						const previous = scenarios.find((scenario) => scenario.name === name);
						const written = BoardScenarioSchema.parse({
							projectId,
							name,
							projectRevision: state.project.revision,
							version: state.project.version,
							bytes,
							createdAtMs: previous?.createdAtMs ?? clockMs,
							updatedAtMs: Math.max(
								clockMs,
								(previous?.updatedAtMs ?? clockMs - 1) + 1,
							),
						});
						const target = yield* state.paths.scenarioFileFx(name);
						yield* withProjectLockFx(
							filesystemWrite,
							state.paths.root,
							filesystemWrite.replaceFileFx({
								lock: state.paths.lockFile,
								target,
								bytes: encodeJsonFn(
									BoardScenarioFileSchema.parse({
										name: written.name,
										revision: written.projectRevision,
										version: written.version,
										save: Buffer.from(written.bytes).toString("base64"),
										createdAtMs: written.createdAtMs,
										updatedAtMs: written.updatedAtMs,
									}),
								),
							}),
						);
						publishScenariosFn(state, [
							written,
							...scenarios.filter((scenario) => scenario.name !== name),
						]);
						return written;
					}),
				);
			}).pipe(
				Effect.mapError((cause) =>
					errorFn(
						"write-board-scenario",
						`Board scenario ${candidateName} could not be saved in project ${projectId}.`,
						cause,
					),
				),
			);

		const deleteBoardScenarioFx: Operations["deleteBoardScenarioFx"] = ({ projectId, name }) =>
			operations.withPermits(1)(
				Effect.gen(function* () {
					const state = yield* readStateFx(projectId);
					const target = yield* state.paths.scenarioFileFx(name);
					yield* withProjectLockFx(
						filesystemWrite,
						state.paths.root,
						filesystemWrite.removeFileFx({
							lock: state.paths.lockFile,
							target,
						}),
					);
					publishScenariosFn(
						state,
						state.scenarios.filter((scenario) => scenario.name !== name),
					);
				}).pipe(
					Effect.mapError((cause) =>
						errorFn(
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
	},
);
