import { readFile, readdir, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { ZodError } from "zod";
import {
	parseGameConfig,
	parseGameConfigFragment,
	type GameConfig,
	type GameConfigFragment,
} from "../../src/v0/game/config/GameConfigSchema";
import { doesResolvedDomainSelectorMatchId } from "../../src/v0/game/selector/doesResolvedDomainSelectorMatchId";

const collectionKeys = [
	"resources",
	"assets",
	"items",
	"merge",
	"effects",
	"producers",
	"stashes",
	"craftRecipes",
	"products",
] as const;

type CollectionKey = (typeof collectionKeys)[number];
type MergedGameConfig = Omit<GameConfig, "game" | "startingState"> &
	Partial<Pick<GameConfig, "game" | "startingState">>;
type FileSource = {
	path: string;
	json: unknown;
};

export interface CompileDirectoryOptions {
	inputDir: string;
	outDir?: string;
}

export interface CompileDirectoryResult {
	packageName: string;
	gamePath: string;
	assetsPath: string;
	package: GameConfig;
}

export const compileDirectory = async (
	options: CompileDirectoryOptions,
): Promise<CompileDirectoryResult> => {
	const inputDir = resolve(options.inputDir);
	const outDir = resolve(options.outDir ?? dirname(inputDir));
	const packageName = basename(inputDir);
	const jsonPaths = await findFiles(inputDir, ".json");
	const pngPaths = await findFiles(join(inputDir, "assets"), ".png").catch(() => []);
	const sources = await readJsonSources(jsonPaths);
	const generatedResources = await readPngResources(pngPaths);
	const packageValue = mergeSources([
		...sources,
		{
			path: `${relative(process.cwd(), inputDir)}/assets/**/*.png`,
			json: {
				resources: generatedResources,
			},
		},
	]);
	const compiledPackage = validatePackage(packageValue);
	const gamePath = join(outDir, `${packageName}.game.json`);
	const assetsPath = join(outDir, `${packageName}.assets.json`);
	const gameOutput = withoutResources(compiledPackage);
	const assetsOutput = {
		version: compiledPackage.version,
		resources: compiledPackage.resources,
	};

	await writePrettyJson(gamePath, gameOutput);
	await writePrettyJson(assetsPath, assetsOutput);

	return {
		packageName,
		gamePath,
		assetsPath,
		package: compiledPackage,
	};
};

export const validateSources = async (paths: readonly string[]) => {
	const resolvedPaths =
		paths.length === 0
			? [
					"game/arkini",
				]
			: paths;
	const sources: FileSource[] = [];

	for (const path of resolvedPaths) {
		const resolvedPath = resolve(path);

		if (await isDirectory(resolvedPath)) {
			const jsonPaths = await findFiles(resolvedPath, ".json");
			const pngPaths = await findFiles(join(resolvedPath, "assets"), ".png").catch(() => []);

			sources.push(...(await readJsonSources(jsonPaths)));
			sources.push({
				path: `${relative(process.cwd(), resolvedPath)}/assets/**/*.png`,
				json: {
					resources: await readPngResources(pngPaths),
				},
			});

			continue;
		}

		sources.push(
			...(await readJsonSources([
				resolvedPath,
			])),
		);
	}

	const packageValue = mergeSources(sources);

	return validatePackage(packageValue);
};

const mergeSources = (sources: readonly FileSource[]): MergedGameConfig => {
	const output = createEmptyPackage();
	const sourceByKey = new Map<string, string>();

	for (const source of sources) {
		let fragment: GameConfigFragment;

		try {
			fragment = parseGameConfigFragment(source.json);
		} catch (error) {
			throw formatZodError(error, source.path);
		}

		if (fragment.version !== undefined && fragment.version !== 1) {
			throw new Error(`${source.path}: version must be 1.`);
		}

		if (fragment.game) {
			assignSingleton(output, sourceByKey, source.path, "game", fragment.game);
		}

		if (fragment.startingState) {
			assignSingleton(
				output,
				sourceByKey,
				source.path,
				"startingState",
				fragment.startingState,
			);
		}

		for (const key of collectionKeys) {
			const collection = fragment[key];

			if (!collection) {
				continue;
			}

			for (const [entryId, entry] of Object.entries(collection)) {
				const sourceKey = `${key}.${entryId}`;
				const previousSource = sourceByKey.get(sourceKey);

				if (previousSource) {
					throw new Error(
						`${source.path}: duplicate ${key} entry "${entryId}" already defined by ${previousSource}.`,
					);
				}

				(output[key] as Record<string, unknown>)[entryId] = entry;
				sourceByKey.set(sourceKey, source.path);
			}
		}
	}

	return output;
};

const validatePackage = (value: unknown): GameConfig => {
	try {
		return parseGameConfig(normalizePackage(value));
	} catch (error) {
		throw formatZodError(error, "compiled package");
	}
};

const normalizePackage = (value: unknown): unknown => {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return value;
	}

	const packageValue = value as Record<string, unknown>;
	const items = asRecord(packageValue.items);
	const sourceAssets = asRecord(packageValue.assets);
	const assets: Record<string, unknown> = {
		...sourceAssets,
	};
	const normalizedItems: Record<string, unknown> = {};
	const craftRecipes = asRecord(packageValue.craftRecipes);
	const normalizedCraftRecipes: Record<string, unknown> = {};
	const products = asRecord(packageValue.products);
	const normalizedProducts: Record<string, unknown> = {};
	const effects = asRecord(packageValue.effects);

	for (const [itemId, itemEntry] of Object.entries(items)) {
		if (!itemEntry || typeof itemEntry !== "object" || Array.isArray(itemEntry)) {
			normalizedItems[itemId] = itemEntry;
			continue;
		}

		const item = {
			...(itemEntry as Record<string, unknown>),
		};
		const assetIds = Array.isArray(item.assetIds)
			? item.assetIds
			: [
					`asset:${itemId}`,
				];

		item.assetIds = assetIds;
		normalizedItems[itemId] = item;

		for (const assetId of assetIds) {
			if (typeof assetId !== "string") continue;
			assets[assetId] = normalizeAssetDefinition(assetId, assets[assetId]);
		}
	}

	for (const [craftRecipeId, craftRecipeEntry] of Object.entries(craftRecipes)) {
		if (
			!craftRecipeEntry ||
			typeof craftRecipeEntry !== "object" ||
			Array.isArray(craftRecipeEntry)
		) {
			normalizedCraftRecipes[craftRecipeId] = craftRecipeEntry;
			continue;
		}

		const craftRecipe = {
			...(craftRecipeEntry as Record<string, unknown>),
		};

		craftRecipe.resultItemId ??= readCraftResultItemIdFromCraftTargetId(craftRecipeId);
		craftRecipe.effects = normalizeLineEffects({
			domainIndexes: {
				items: createTaggedDomainIndex({
					entries: normalizedItems,
					ids: Object.keys(normalizedItems),
					label: "item",
				}),
			},
			effects: craftRecipe.effects,
			path: `craftRecipes.${craftRecipeId}.effects`,
		});
		normalizedCraftRecipes[craftRecipeId] = craftRecipe;
	}

	for (const [productId, productEntry] of Object.entries(products)) {
		if (!productEntry || typeof productEntry !== "object" || Array.isArray(productEntry)) {
			normalizedProducts[productId] = productEntry;
			continue;
		}

		const product = {
			...(productEntry as Record<string, unknown>),
		};

		product.name ??= readProductNameFromPrimaryOutput(product, normalizedItems);
		const productDomainIndexes = {
			items: createTaggedDomainIndex({
				entries: normalizedItems,
				ids: Object.keys(normalizedItems),
				label: "item",
			}),
		};
		product.output = normalizeActivationOutputEffects({
			domainIndexes: productDomainIndexes,
			output: product.output,
			path: `products.${productId}.output`,
		});
		normalizedProducts[productId] = product;
	}

	const normalizedEffects = normalizeEffectDefinitions({
		craftRecipes: normalizedCraftRecipes,
		effects,
		items: normalizedItems,
		producers: asRecord(packageValue.producers),
		products: normalizedProducts,
	});

	return {
		...packageValue,
		assets,
		craftRecipes: normalizedCraftRecipes,
		effects: normalizedEffects,
		items: normalizedItems,
		products: normalizedProducts,
	};
};

const normalizeAssetDefinition = (assetId: string, sourceAsset: unknown): unknown => {
	const asset =
		sourceAsset && typeof sourceAsset === "object" && !Array.isArray(sourceAsset)
			? {
					...(sourceAsset as Record<string, unknown>),
				}
			: {};
	const blueprintSuffix = readBlueprintAssetSuffix(assetId);

	asset.render ??= blueprintSuffix ? "blueprint" : "plain";
	asset.resourceId ??= blueprintSuffix ? "item-blueprint" : readResourceIdFromAssetId(assetId);

	if (blueprintSuffix) {
		asset.overlayAssetId ??= `asset:producer:${blueprintSuffix}`;
	}

	return asset;
};

const asRecord = (value: unknown): Record<string, unknown> =>
	value && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};

type AuthoringDomainSelectorRef =
	| {
			id: string;
	  }
	| {
			ids: string[];
	  }
	| {
			tag: string;
	  };

type AuthoringDomainSelector =
	| {
			mode: "all";
	  }
	| {
			anyOf?: AuthoringDomainSelectorRef[];
			allOf?: AuthoringDomainSelectorRef[];
			noneOf?: AuthoringDomainSelectorRef[];
	  };

type ResolvedDomainSelectorClause = {
	ids: string[];
};

type ResolvedDomainSelector =
	| {
			mode: "all";
	  }
	| {
			anyOf?: ResolvedDomainSelectorClause[];
			allOf?: ResolvedDomainSelectorClause[];
			noneOf?: ResolvedDomainSelectorClause[];
	  };

type DomainIndex = {
	ids: readonly string[];
	label: string;
	tagsById: ReadonlyMap<string, ReadonlySet<string>>;
};

const normalizeEffectDefinitions = ({
	effects,
}: {
	craftRecipes: Readonly<Record<string, unknown>>;
	effects: Readonly<Record<string, unknown>>;
	items: Readonly<Record<string, unknown>>;
	producers: Readonly<Record<string, unknown>>;
	products: Readonly<Record<string, unknown>>;
}) => {
	const normalizedEffects: Record<string, unknown> = {};

	for (const [effectId, effectEntry] of Object.entries(effects)) {
		if (!effectEntry || typeof effectEntry !== "object" || Array.isArray(effectEntry)) {
			normalizedEffects[effectId] = effectEntry;
			continue;
		}

		const effect = {
			...(effectEntry as Record<string, unknown>),
		};
		normalizedEffects[effectId] = effect;
	}

	return normalizedEffects;
};

const normalizeLineEffects = ({
	domainIndexes,
	effects,
	path,
}: {
	domainIndexes: {
		items: DomainIndex;
	};
	effects: unknown;
	path: string;
}) => {
	if (!Array.isArray(effects)) return effects;
	return effects.map((effectEntry, effectIndex) => {
		if (!effectEntry || typeof effectEntry !== "object" || Array.isArray(effectEntry)) {
			return effectEntry;
		}
		const effect = {
			...(effectEntry as Record<string, unknown>),
		};
		if (
			(effect.kind === "nearby.require" || effect.kind === "nearby.duration.multiply") &&
			effect.items !== undefined
		) {
			effect.items = normalizeAuthoringDomainSelector({
				domain: domainIndexes.items,
				path: `${path}.${effectIndex}.items`,
				selector: asAuthoringDomainSelector(effect.items),
			});
		}
		return effect;
	});
};

const normalizeDropEffects = ({
	domainIndexes,
	effects,
	path,
}: {
	domainIndexes: {
		items: DomainIndex;
	};
	effects: unknown;
	path: string;
}) => {
	if (!Array.isArray(effects)) return effects;
	return effects.map((effectEntry, effectIndex) => {
		if (!effectEntry || typeof effectEntry !== "object" || Array.isArray(effectEntry)) {
			return effectEntry;
		}
		const effect = {
			...(effectEntry as Record<string, unknown>),
		};
		if (
			(effect.kind === "nearby.require" || effect.kind === "nearby.duration.multiply") &&
			effect.items !== undefined
		) {
			effect.items = normalizeAuthoringDomainSelector({
				domain: domainIndexes.items,
				path: `${path}.${effectIndex}.items`,
				selector: asAuthoringDomainSelector(effect.items),
			});
		}
		if (effect.kind === "nearby.loot.outputChance.add" && Array.isArray(effect.sources)) {
			effect.sources = effect.sources.map((sourceEntry, sourceIndex) => {
				if (!sourceEntry || typeof sourceEntry !== "object" || Array.isArray(sourceEntry)) {
					return sourceEntry;
				}

				const source = {
					...(sourceEntry as Record<string, unknown>),
				};
				if (source.items !== undefined) {
					source.items = normalizeAuthoringDomainSelector({
						domain: domainIndexes.items,
						path: `${path}.${effectIndex}.sources.${sourceIndex}.items`,
						selector: asAuthoringDomainSelector(source.items),
					});
				}
				return source;
			});
		}
		return effect;
	});
};

const normalizeActivationOutputEffects = ({
	domainIndexes,
	output,
	path,
}: {
	domainIndexes: {
		items: DomainIndex;
	};
	output: unknown;
	path: string;
}) => {
	if (!Array.isArray(output)) return output;

	return output.map((outputEntry, outputIndex) => {
		if (!outputEntry || typeof outputEntry !== "object" || Array.isArray(outputEntry)) {
			return outputEntry;
		}
		const entry = {
			...(outputEntry as Record<string, unknown>),
		};
		if (entry.type === "weighted" && Array.isArray(entry.entries)) {
			entry.entries = entry.entries.map((weightedEntry, weightedEntryIndex) => {
				if (
					!weightedEntry ||
					typeof weightedEntry !== "object" ||
					Array.isArray(weightedEntry)
				) {
					return weightedEntry;
				}
				const normalizedWeightedEntry = {
					...(weightedEntry as Record<string, unknown>),
				};
				normalizedWeightedEntry.effects = normalizeDropEffects({
					domainIndexes,
					effects: normalizedWeightedEntry.effects,
					path: `${path}.${outputIndex}.entries.${weightedEntryIndex}.effects`,
				});
				return normalizedWeightedEntry;
			});
			return entry;
		}
		entry.effects = normalizeDropEffects({
			domainIndexes,
			effects: entry.effects,
			path: `${path}.${outputIndex}.effects`,
		});
		return entry;
	});
};

const asAuthoringDomainSelector = (value: unknown): AuthoringDomainSelector =>
	asRecord(value) as AuthoringDomainSelector;

const createTaggedDomainIndex = ({
	entries,
	ids,
	label,
}: {
	entries: Readonly<Record<string, unknown>>;
	ids: readonly string[];
	label: string;
}): DomainIndex => ({
	ids,
	label,
	tagsById: new Map(
		ids.map((id) => [
			id,
			new Set(readDefinitionTags(entries[id])),
		]),
	),
});

const readDefinitionTags = (entry: unknown) => {
	if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
	const tags = (entry as Record<string, unknown>).tags;
	if (!Array.isArray(tags)) return [];
	return tags.filter((tag): tag is string => typeof tag === "string");
};

const normalizeAuthoringDomainSelector = ({
	domain,
	path,
	selector,
}: {
	domain: DomainIndex;
	path: string;
	selector: AuthoringDomainSelector;
}): ResolvedDomainSelector => {
	if ("mode" in selector) {
		return {
			mode: "all",
		};
	}

	const anyOf = normalizeAuthoringDomainSelectorRefs({
		domain,
		path: `${path}.anyOf`,
		refs: selector.anyOf,
	});
	const allOf = normalizeAuthoringDomainSelectorRefs({
		domain,
		path: `${path}.allOf`,
		refs: selector.allOf,
	});
	const noneOf = normalizeAuthoringDomainSelectorRefs({
		domain,
		path: `${path}.noneOf`,
		refs: selector.noneOf,
	});
	const normalizedSelector: ResolvedDomainSelector = {
		...(anyOf
			? {
					anyOf,
				}
			: {}),
		...(allOf
			? {
					allOf,
				}
			: {}),
		...(noneOf
			? {
					noneOf,
				}
			: {}),
	};

	if (!anyOf && !allOf && !noneOf) {
		throw new Error(`${path}: selector must define anyOf, allOf, noneOf, or mode: "all".`);
	}

	const matchedIds = domain.ids.filter((id) =>
		doesResolvedDomainSelectorMatchId({
			entityId: id,
			selector: normalizedSelector,
		}),
	);
	if (matchedIds.length === 0) {
		throw new Error(`${path}: selector matched no ${domain.label}s.`);
	}

	return normalizedSelector;
};

const normalizeAuthoringDomainSelectorRefs = ({
	domain,
	path,
	refs,
}: {
	domain: DomainIndex;
	path: string;
	refs: readonly AuthoringDomainSelectorRef[] | undefined;
}): ResolvedDomainSelectorClause[] | undefined => {
	if (!refs) return undefined;
	validateUniqueSelectorRefs(refs, path);

	return refs.map((ref, index) => ({
		ids: resolveAuthoringDomainSelectorRef({
			domain,
			path: `${path}.${index}`,
			ref,
		}),
	}));
};

const resolveAuthoringDomainSelectorRef = ({
	domain,
	path,
	ref,
}: {
	domain: DomainIndex;
	path: string;
	ref: AuthoringDomainSelectorRef;
}) => {
	if ("id" in ref) {
		if (domain.ids.includes(ref.id)) {
			return [
				ref.id,
			];
		}

		throw new Error(`${path}.id: Missing ${domain.label} "${ref.id}".`);
	}

	if ("ids" in ref) {
		for (const id of ref.ids) {
			if (!domain.ids.includes(id)) {
				throw new Error(`${path}.ids: Missing ${domain.label} "${id}".`);
			}
		}
		return ref.ids;
	}

	validateKnownTags(
		domain,
		[
			ref.tag,
		],
		`${path}.tag`,
	);

	return domain.ids.filter((id) => domain.tagsById.get(id)?.has(ref.tag));
};

const validateUniqueSelectorRefs = (refs: readonly AuthoringDomainSelectorRef[], path: string) => {
	validateUniqueValues(
		refs.map(readAuthoringDomainSelectorRefKey),
		path,
		(value) => `Duplicate selector reference "${value}".`,
	);
};

const readAuthoringDomainSelectorRefKey = (ref: AuthoringDomainSelectorRef) =>
	"id" in ref ? `id:${ref.id}` : "ids" in ref ? `ids:${ref.ids.join(",")}` : `tag:${ref.tag}`;

const validateKnownTags = (domain: DomainIndex, tags: readonly string[], path: string) => {
	for (const [index, tag] of tags.entries()) {
		if (doesDomainContainTag(domain, tag)) continue;
		throw new Error(`${path}.${index}: Unknown ${domain.label} tag "${tag}".`);
	}
};

const doesDomainContainTag = (domain: DomainIndex, tag: string) => {
	for (const tags of domain.tagsById.values()) {
		if (tags.has(tag)) return true;
	}
	return false;
};

const validateUniqueValues = (
	values: readonly string[],
	path: string,
	createMessage: (value: string) => string,
) => {
	const seen = new Set<string>();
	for (const [index, value] of values.entries()) {
		if (!seen.has(value)) {
			seen.add(value);
			continue;
		}
		throw new Error(`${path}.${index}: ${createMessage(value)}`);
	}
};

const readProductNameFromPrimaryOutput = (
	product: Readonly<Record<string, unknown>>,
	items: Readonly<Record<string, unknown>>,
) => {
	const output = Array.isArray(product.output) ? product.output : [];
	const primaryOutput = output.find(
		(
			entry,
		): entry is {
			itemId: string;
		} =>
			!!entry &&
			typeof entry === "object" &&
			!Array.isArray(entry) &&
			typeof (entry as Record<string, unknown>).itemId === "string",
	);

	if (!primaryOutput) {
		return undefined;
	}

	const item = items[primaryOutput.itemId];

	return item && typeof item === "object" && !Array.isArray(item)
		? (item as Record<string, unknown>).name
		: undefined;
};

const readCraftResultItemIdFromCraftTargetId = (craftTargetItemId: string) => {
	const prefix = "item:blueprint-";

	return craftTargetItemId.startsWith(prefix)
		? `producer:${craftTargetItemId.slice(prefix.length)}`
		: undefined;
};

const readBlueprintAssetSuffix = (assetId: string) => {
	const prefix = "asset:item:blueprint-";

	return assetId.startsWith(prefix) ? assetId.slice(prefix.length) : undefined;
};

const readResourceIdFromAssetId = (assetId: string) => {
	const [namespace, kind, ...rest] = assetId.split(":");
	const assetCode = rest.join(":");

	return namespace === "asset" && kind && assetCode ? `${kind}-${assetCode}` : assetId;
};

const readJsonSources = async (paths: readonly string[]) => {
	const sortedPaths = [
		...paths,
	].sort((left, right) => left.localeCompare(right));

	return Promise.all(
		sortedPaths.map(async (path) => {
			const jsonText = await readFile(path, "utf8");

			try {
				return {
					path: relative(process.cwd(), path),
					json: JSON.parse(jsonText) as unknown,
				};
			} catch (error) {
				throw new Error(
					`${relative(process.cwd(), path)}: invalid JSON. ${formatUnknownError(error)}`,
				);
			}
		}),
	);
};

const readPngResources = async (paths: readonly string[]) => {
	const resources: Record<
		string,
		{
			data: string;
		}
	> = {};

	for (const path of [
		...paths,
	].sort((left, right) => left.localeCompare(right))) {
		const resourceId = basename(path, extname(path));

		if (Object.hasOwn(resources, resourceId)) {
			throw new Error(
				`${relative(process.cwd(), path)}: duplicate PNG resource id "${resourceId}" from basename.`,
			);
		}

		const bytes = await readFile(path);
		assertPng(bytes, path);
		resources[resourceId] = {
			data: bytes.toString("base64"),
		};
	}

	return resources;
};

const findFiles = async (root: string, extension: string): Promise<string[]> => {
	const entries = await readdir(root, {
		withFileTypes: true,
	});
	const files = await Promise.all(
		entries.map(async (entry) => {
			const entryPath = join(root, entry.name);

			if (entry.isDirectory()) {
				return findFiles(entryPath, extension);
			}

			if (entry.isFile() && entry.name.endsWith(extension)) {
				return [
					entryPath,
				];
			}

			return [];
		}),
	);

	return files.flat();
};

const isDirectory = async (path: string) => {
	try {
		const { stat } = await import("node:fs/promises");

		return (await stat(path)).isDirectory();
	} catch {
		return false;
	}
};

const createEmptyPackage = (): MergedGameConfig => ({
	version: 1,
	resources: {},
	assets: {},
	items: {},
	merge: {},
	producers: {},
	stashes: {},
	craftRecipes: {},
	effects: {},
	products: {},
});

const assignSingleton = <T>(
	output: Record<string, unknown>,
	sourceByKey: Map<string, string>,
	sourcePath: string,
	key: string,
	value: T,
) => {
	const previousSource = sourceByKey.get(key);

	if (previousSource) {
		throw new Error(`${sourcePath}: duplicate ${key} already defined by ${previousSource}.`);
	}

	output[key] = value;
	sourceByKey.set(key, sourcePath);
};

const withoutResources = (value: GameConfig) => {
	const { resources: _resources, ...rest } = value;

	return rest;
};

const writePrettyJson = async (path: string, value: unknown) => {
	await writeFile(path, `${JSON.stringify(sortJson(value), null, "\t")}\n`);
};

const sortJson = (value: unknown): unknown => {
	if (Array.isArray(value)) {
		return value.map(sortJson);
	}

	if (!value || typeof value !== "object") {
		return value;
	}

	return Object.fromEntries(
		Object.entries(value)
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([key, entry]) => [
				key,
				sortJson(entry),
			]),
	);
};

const assertPng = (bytes: Buffer, path: string) => {
	const pngMagic = "89504e470d0a1a0a";
	if (bytes.subarray(0, 8).toString("hex") !== pngMagic) {
		throw new Error(`${relative(process.cwd(), path)}: expected a PNG file.`);
	}
};

const formatZodError = (error: unknown, source: string) => {
	if (!(error instanceof ZodError)) {
		return error;
	}

	const details = error.issues
		.map((issue) => {
			const path = issue.path.length > 0 ? `/${issue.path.join("/")}` : "/";

			return `  ${path}: ${issue.message}`;
		})
		.join("\n");

	return new Error(`${source}: validation failed.\n${details}`);
};

const formatUnknownError = (error: unknown) =>
	error instanceof Error ? error.message : String(error);
