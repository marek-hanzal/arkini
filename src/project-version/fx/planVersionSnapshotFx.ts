import { Effect } from "effect";

import type { BoardScenarioFileSchema } from "~/board-scenario/schema/BoardScenarioFileSchema";
import { GameProjectGameSchemaReference } from "~/game-config-source/constant/GameProjectReference";
import { GameFileSchema } from "~/game-config-source/schema/GameFileSchema";
import { VersionManifestSchema } from "~/project-version/schema/VersionManifestSchema";
import { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { ResourceSchema } from "~/game-config-resource/schema/ResourceSchema";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { VersionSchema as GameVersionSchema } from "~/game-version/schema/VersionSchema";
import {
	createVersionFingerprintFn,
	hashVersionBytesFn,
	hashVersionJsonFn,
} from "~/project-version/fn/createVersionFingerprintFn";

const sortedRecordFn = (
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
		readonly arkpack: GameVersionSchema.Type;
		readonly config: GameConfigSchema.Type;
		readonly resources: ReadonlyArray<ResourceSchema.Type>;
		readonly scenarios: ReadonlyArray<BoardScenarioFileSchema.Type>;
	}
}

/** Creates the one canonical manifest/fingerprint plan shared by preview and object writes. */
export const planVersionSnapshotFx = Effect.fn("planVersionSnapshotFx")(
	(props: planVersionSnapshotFx.Props) =>
		Effect.try({
			try: () => materializePlanFn(props),
			catch: (cause) => cause,
		}),
);

const materializePlanFn = ({
	arkpack,
	config,
	resources,
	scenarios,
}: planVersionSnapshotFx.Props) => {
	const jsonObjects = new Map<string, unknown>();
	const pngObjects = new Map<string, Uint8Array>();
	const addJsonFn = (value: unknown) => {
		const hash = hashVersionJsonFn(value);
		if (!jsonObjects.has(hash)) jsonObjects.set(hash, value);
		return hash;
	};
	const addPngFn = (bytes: Uint8Array) => {
		const hash = hashVersionBytesFn(bytes);
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
			addJsonFn(item),
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
			addPngFn(resource.bytes),
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
			addJsonFn(scenario),
		]);
	}

	const manifest = VersionManifestSchema.parse({
		game: addJsonFn(game),
		items: sortedRecordFn(itemHashes),
		assets: sortedRecordFn(assetHashes),
		resources: sortedRecordFn(resourceHashes),
		scenarios: sortedRecordFn(scenarioHashes),
	});
	return {
		manifest,
		contentFingerprint: createVersionFingerprintFn(manifest, scenarios),
		jsonObjects,
		pngObjects,
	};
};
