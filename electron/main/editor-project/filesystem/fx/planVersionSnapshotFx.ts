import { Effect } from "effect";

import type { EditorBoardScenarioFileSchema } from "~/board-scenario/EditorBoardScenarioFileSchema";
import { GameProjectGameSchemaReference } from "~/game-config/source/GameProjectReference";
import { GameFileSchema } from "~/game-config/source/schema/GameFileSchema";
import { EditorVersionManifestSchema } from "~/project-version/EditorVersionManifestSchema";
import { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { ResourceSchema } from "~/game-config/resource/schema/ResourceSchema";
import type { GameConfigSchema } from "~/game-config/GameConfigSchema";
import type { ArkpackVersionSchema } from "~/engine/version/schema/ArkpackVersionSchema";
import { createVersionFingerprint, hashVersionBytes, hashVersionJson } from "./VersionFingerprint";

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

export namespace planVersionSnapshotFx {
	export interface Props {
		readonly arkpack: ArkpackVersionSchema.Type;
		readonly config: GameConfigSchema.Type;
		readonly resources: ReadonlyArray<ResourceSchema.Type>;
		readonly scenarios: ReadonlyArray<EditorBoardScenarioFileSchema.Type>;
	}
}

/** Creates the one canonical manifest/fingerprint plan shared by preview and object writes. */
export const planVersionSnapshotFx = Effect.fn("planVersionSnapshotFx")(
	(props: planVersionSnapshotFx.Props) =>
		Effect.try({
			try: () => materializePlan(props),
			catch: (cause) => cause,
		}),
);

const materializePlan = ({
	arkpack,
	config,
	resources,
	scenarios,
}: planVersionSnapshotFx.Props) => {
	const jsonObjects = new Map<string, unknown>();
	const pngObjects = new Map<string, Uint8Array>();
	const addJson = (value: unknown) => {
		const hash = hashVersionJson(value);
		if (!jsonObjects.has(hash)) jsonObjects.set(hash, value);
		return hash;
	};
	const addPng = (bytes: Uint8Array) => {
		const hash = hashVersionBytes(bytes);
		if (!pngObjects.has(hash)) pngObjects.set(hash, bytes);
		return hash;
	};

	const { $schema: _schema, items, ...gameCandidate } = config;
	const game = GameFileSchema.parse({
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
		contentFingerprint: createVersionFingerprint(manifest, scenarios),
		jsonObjects,
		pngObjects,
	};
};
