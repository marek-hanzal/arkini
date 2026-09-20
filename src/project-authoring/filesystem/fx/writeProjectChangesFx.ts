import { AudioResourceMetadataSchema } from "~/audio-authoring/schema/AudioResourceMetadataSchema";
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
	resourceRename,
	noteUpdates,
}: {
	readonly root: string;
	readonly previous: Project;
	readonly next: Project;
	readonly resourceFileWrites?: ReadonlyArray<{
		readonly id: string;
		readonly path: string;
	}>;
	readonly resourceRename?: {
		readonly from: string;
		readonly to: string;
	};
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
			for (const [itemId, item] of Object.entries(nextItems)) {
				if (item.id !== itemId)
					return yield* Effect.fail(
						new Error(
							`Editor item record key ${JSON.stringify(itemId)} differs from item ID ${JSON.stringify(item.id)}.`,
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
					resource.id,
					resource,
				]),
			);
			const resourceFiles = new Map(
				resourceFileWrites.map((resource) => [
					resource.id,
					resource.path,
				]),
			);
			for (const resource of next.resources) {
				const oldId =
					resourceRename?.to === resource.id ? resourceRename.from : resource.id;
				const old = previousResources.get(oldId);
				const target = yield* paths.resourceFileFx(resource);
				yield* admitTargetFx(target);
				const oldTarget = old === undefined ? undefined : yield* paths.resourceFileFx(old);
				const metadataTarget =
					resource.type === "music" || resource.type === "sfx"
						? yield* paths.audioMetadataFileFx({
								id: resource.id,
								type: resource.type,
							})
						: undefined;
				const oldMetadataTarget =
					old?.type === "music" || old?.type === "sfx"
						? yield* paths.audioMetadataFileFx({
								id: old.id,
								type: old.type,
							})
						: undefined;
				if (oldMetadataTarget !== undefined && oldMetadataTarget !== metadataTarget)
					deletes.add(oldMetadataTarget);
				if (metadataTarget !== undefined) {
					yield* admitTargetFx(metadataTarget);
					const metadata = yield* Effect.try(() =>
						AudioResourceMetadataSchema.parse({
							name: resource.name,
						}),
					);
					if (oldMetadataTarget !== metadataTarget || old?.name !== metadata.name) {
						writes.push({
							target: metadataTarget,
							bytes: encodeJsonFn(metadata),
						});
						changedResources.add(resource.id);
					}
				}
				let source = resourceFiles.get(resource.id);
				if (oldTarget !== undefined && oldTarget !== target) {
					deletes.add(oldTarget);
					source ??= oldTarget;
				}
				if (source !== undefined) {
					writes.push({
						target,
						source,
					});
					changedResources.add(resource.id);
				} else if (old === undefined) {
					return yield* Effect.fail(
						new Error(`New Editor resource ${resource.id} has no content.`),
					);
				}
				previousResources.delete(oldId);
			}
			for (const resource of previousResources.values()) {
				deletes.add(yield* paths.resourceFileFx(resource));
				if (resource.type === "music" || resource.type === "sfx")
					deletes.add(
						yield* paths.audioMetadataFileFx({
							id: resource.id,
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
						resourceIds: note.resourceIds,
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
					changedResources.has(resource.id)
						? Effect.gen(function* () {
								const target = yield* paths.resourceFileFx(resource);
								return yield* readProjectResourceMetadataFx(
									resource.id,
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
