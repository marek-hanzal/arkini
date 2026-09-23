import { ResourceMetadataSchema } from "~/game-config-resource/schema/ResourceMetadataSchema";
import { isDeepStrictEqual } from "node:util";
import { Effect, FileSystem } from "effect";

import {
	GameProjectGameSchemaReference,
	GameProjectItemSchemaReference,
} from "~/game-config-source/constant/GameProjectReference";
import { SerakkiAppVersion } from "~shared/SerakkiAppMetadata";
import type { Project } from "~/project-authoring/type/Project";
import type { NoteSchema } from "~/project-note/schema/NoteSchema";
import { createFilesystemWriteFx } from "~/filesystem-write/fx/createFilesystemWriteFx";
import { createProjectPathsFx } from "../createProjectPathsFx";
import { readProjectResourceMetadataFx } from "./readProjectResourceMetadataFx";
import { type ProjectFileSetPlan, writeProjectFileSetFx } from "./writeProjectFileSetFx";

const encodeJsonFn = (value: unknown) =>
	new TextEncoder().encode(`${JSON.stringify(value, undefined, "\t")}\n`);

/** Commits only changed authored entities; unchanged disk bodies never enter the save flow. */
export const writeProjectChangesFx = Effect.fn("writeProjectChangesFx")(function* ({
	root,
	previous,
	next,
	resourceFileWrites = [],
	noteUpdates,
}: {
	readonly root: string;
	readonly previous: Project;
	readonly next: Project;
	readonly resourceFileWrites?: ReadonlyArray<{
		readonly uid: string;
		readonly path: string;
	}>;
	readonly noteUpdates: ReadonlyArray<NoteSchema.Type>;
}) {
	const fileSystem = yield* FileSystem.FileSystem;
	const paths = yield* createProjectPathsFx(root);
	const filesystemWrite = yield* createFilesystemWriteFx();
	const changedResources = new Set<string>();
	let committedResources = next.resources;
	yield* writeProjectFileSetFx({
		root,
		filesystemWrite,
		planFx: Effect.gen(function* () {
			const writes: Array<ProjectFileSetPlan["writes"][number]> = [];
			const deletes = new Set<string>();
			const finalTargets = new Map<string, string>();
			const admitTargetFx = (target: string) =>
				Effect.gen(function* () {
					const key = target.normalize("NFD").toLowerCase();
					const previousTarget = finalTargets.get(key);
					if (previousTarget !== undefined)
						return yield* Effect.fail(
							new Error(
								`Editor files ${JSON.stringify(previousTarget)} and ${JSON.stringify(target)} collide on this filesystem.`,
							),
						);
					finalTargets.set(key, target);
				});
			const {
				$schema: _previousSchema,
				items: previousItems,
				...previousGame
			} = previous.config;
			const { $schema: _nextSchema, items: nextItems, ...nextGame } = next.config;
			if (
				!isDeepStrictEqual(previousGame, nextGame) ||
				!isDeepStrictEqual(previous.version, next.version)
			) {
				writes.push({
					target: paths.gameFile,
					bytes: encodeJsonFn({
						$schema: GameProjectGameSchemaReference,
						version: next.version,
						...nextGame,
					}),
				});
			}
			const previousByUid = new Map(
				Object.values(previousItems).map((item) => [
					item.uid,
					item,
				]),
			);
			const itemUids = new Set<string>();
			for (const [itemUid, item] of Object.entries(nextItems)) {
				if (item.uid !== itemUid)
					return yield* Effect.fail(
						new Error(
							`Editor item record key ${JSON.stringify(itemUid)} differs from item UID ${JSON.stringify(item.uid)}.`,
						),
					);
				if (itemUids.has(item.uid))
					return yield* Effect.fail(
						new Error(`Editor item UID ${item.uid} is duplicated.`),
					);
				itemUids.add(item.uid);
				const target = yield* paths.itemFileFx({
					uid: item.uid,
				});
				yield* admitTargetFx(target);
				if (!isDeepStrictEqual(previousByUid.get(item.uid), item)) {
					writes.push({
						target,
						bytes: encodeJsonFn({
							$schema: GameProjectItemSchemaReference,
							item,
						}),
					});
				}
				previousByUid.delete(item.uid);
			}
			for (const uid of previousByUid.keys())
				deletes.add(
					yield* paths.itemFileFx({
						uid,
					}),
				);
			const previousResources = new Map(
				previous.resources.map((resource) => [
					resource.uid,
					resource,
				]),
			);
			const resourceFiles = new Map(
				resourceFileWrites.map((resource) => [
					resource.uid,
					resource.path,
				]),
			);
			for (const resource of next.resources) {
				const oldUid = resource.uid;
				const old = previousResources.get(oldUid);
				if (old !== undefined && old.type !== resource.type)
					return yield* Effect.fail(
						new Error(`Editor resource ${resource.uid} cannot change type.`),
					);
				const target = yield* paths.resourceFileFx(resource);
				yield* admitTargetFx(target);
				const metadataTarget = yield* paths.resourceMetadataFileFx(resource);
				yield* admitTargetFx(metadataTarget);
				const metadata = yield* Effect.try(() =>
					ResourceMetadataSchema.parse({
						title: resource.title,
					}),
				);
				if (old?.title !== metadata.title) {
					writes.push({
						target: metadataTarget,
						bytes: encodeJsonFn(metadata),
					});
					changedResources.add(resource.uid);
				}
				const source = resourceFiles.get(resource.uid);
				if (source !== undefined) {
					writes.push({
						target,
						source,
					});
					changedResources.add(resource.uid);
				} else if (old === undefined) {
					return yield* Effect.fail(
						new Error(`New Editor resource ${resource.uid} has no content.`),
					);
				}
				previousResources.delete(oldUid);
			}
			for (const resource of previousResources.values()) {
				deletes.add(yield* paths.resourceFileFx(resource));
				deletes.add(
					yield* paths.resourceMetadataFileFx({
						uid: resource.uid,
						type: resource.type,
					}),
				);
			}
			for (const note of noteUpdates) {
				writes.push({
					target: yield* paths.noteFileFx(note.noteId),
					bytes: encodeJsonFn({
						content: note.content,
						itemUids: note.itemUids,
						resourceUids: note.resourceUids,
						createdAtMs: note.createdAtMs,
						updatedAtMs: note.updatedAtMs,
					}),
				});
			}
			writes.push({
				target: paths.projectFile,
				bytes: encodeJsonFn({
					serakki: SerakkiAppVersion,
					revision: next.revision,
				}),
			});
			return {
				writes,
				verifyFx: Effect.forEach(next.resources, (resource) =>
					changedResources.has(resource.uid)
						? Effect.gen(function* () {
								const target = yield* paths.resourceFileFx(resource);
								return yield* readProjectResourceMetadataFx(
									resource.uid,
									resource.type,
									target,
								);
							})
						: Effect.succeed(resource),
				).pipe(
					Effect.provideService(FileSystem.FileSystem, fileSystem),
					Effect.tap((resources) =>
						Effect.sync(() => {
							committedResources = resources;
						}),
					),
					Effect.asVoid,
				),
				deletes: [
					...deletes,
				],
			};
		}),
	});
	return committedResources;
});
