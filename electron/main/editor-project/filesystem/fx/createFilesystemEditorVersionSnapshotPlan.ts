import type { EditorBoardScenarioFileSchema } from "~/editor/filesystem/EditorBoardScenarioFileSchema";
import { GameProjectGameSchemaReference } from "~/engine/source/GameProjectReference";
import { GameProjectFileSchema } from "~/engine/source/schema/GameProjectFileSchema";
import { EditorVersionManifestSchema } from "~/editor/filesystem/EditorVersionManifestSchema";
import { ItemSchema } from "~/engine/item/schema/ItemSchema";
import type { ResourceSchema } from "~/engine/pack/schema/ResourceSchema";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import type { ArkpackVersionSchema } from "~/engine/version/schema/ArkpackVersionSchema";
import {
	createFilesystemEditorVersionFingerprint,
	hashFilesystemEditorVersionBytes,
	hashFilesystemEditorVersionJson,
} from "./FilesystemEditorVersionFingerprint";

const sortedRecord = (
	entries: ReadonlyArray<
		readonly [
			string,
			string,
		]
	>,
) =>
	Object.fromEntries(
		[
			...entries,
		].sort(([left], [right]) => left.localeCompare(right)),
	);

export namespace createFilesystemEditorVersionSnapshotPlan {
	export interface Props {
		readonly arkpack: ArkpackVersionSchema.Type;
		readonly config: GameConfigSchema.Type;
		readonly resources: ReadonlyArray<ResourceSchema.Type>;
		readonly scenarios: ReadonlyArray<EditorBoardScenarioFileSchema.Type>;
	}
}

/** Creates the one canonical manifest/fingerprint plan shared by preview and object writes. */
export const createFilesystemEditorVersionSnapshotPlan = ({
	arkpack,
	config,
	resources,
	scenarios,
}: createFilesystemEditorVersionSnapshotPlan.Props) => {
	const jsonObjects = new Map<string, unknown>();
	const pngObjects = new Map<string, Uint8Array>();
	const addJson = (value: unknown) => {
		const hash = hashFilesystemEditorVersionJson(value);
		if (!jsonObjects.has(hash)) jsonObjects.set(hash, value);
		return hash;
	};
	const addPng = (bytes: Uint8Array) => {
		const hash = hashFilesystemEditorVersionBytes(bytes);
		if (!pngObjects.has(hash)) pngObjects.set(hash, bytes);
		return hash;
	};

	const { $schema: _schema, items, ...gameCandidate } = config;
	const game = GameProjectFileSchema.parse({
		$schema: GameProjectGameSchemaReference,
		version: arkpack,
		...gameCandidate,
	});
	const itemUids = new Set<string>();
	const itemHashes: Array<
		readonly [
			string,
			string,
		]
	> = [];
	for (const [id, candidate] of Object.entries(items).sort(([left], [right]) =>
		left.localeCompare(right),
	)) {
		const item = ItemSchema.parse(candidate);
		if (item.id !== id)
			throw new Error(`Editor item ${item.uid} is stored under mismatched ID ${id}.`);
		if (itemUids.has(item.uid)) throw new Error(`Editor item UID ${item.uid} is duplicated.`);
		itemUids.add(item.uid);
		itemHashes.push([
			item.uid,
			addJson(item),
		]);
	}

	const shellResourceIds = new Set(
		Object.values(config.resources).filter((id): id is string => id !== undefined),
	);
	const assetHashes: Array<
		readonly [
			string,
			string,
		]
	> = [];
	const resourceHashes: Array<
		readonly [
			string,
			string,
		]
	> = [];
	const resourceIds = new Set<string>();
	for (const resource of [
		...resources,
	].sort((left, right) => left.id.localeCompare(right.id))) {
		if (resourceIds.has(resource.id))
			throw new Error(`Editor resource ${resource.id} is duplicated.`);
		resourceIds.add(resource.id);
		(shellResourceIds.has(resource.id) ? resourceHashes : assetHashes).push([
			resource.id,
			addPng(resource.bytes),
		]);
	}

	const scenarioHashes: Array<
		readonly [
			string,
			string,
		]
	> = [];
	const scenarioNames = new Set<string>();
	for (const scenario of [
		...scenarios,
	].sort((left, right) => left.name.localeCompare(right.name))) {
		if (scenarioNames.has(scenario.name))
			throw new Error(`Editor Board scenario ${scenario.name} is duplicated.`);
		scenarioNames.add(scenario.name);
		scenarioHashes.push([
			scenario.name,
			addJson(scenario),
		]);
	}

	const manifest = EditorVersionManifestSchema.parse({
		game: addJson(game),
		items: sortedRecord(itemHashes),
		assets: sortedRecord(assetHashes),
		resources: sortedRecord(resourceHashes),
		scenarios: sortedRecord(scenarioHashes),
	});
	return {
		manifest,
		contentFingerprint: createFilesystemEditorVersionFingerprint(manifest, scenarios),
		jsonObjects,
		pngObjects,
	};
};
