import { readFile, readdir, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { ZodError } from "zod";
import {
	parseGameConfig,
	parseGameConfigFragment,
	type GameConfig,
	type GameConfigFragment,
} from "../../src/v0/game/config/GameConfigSchema";

const collectionKeys = [
	"resources",
	"assets",
	"items",
	"merge",
	"inputs",
	"producers",
	"stashes",
	"craftRecipes",
	"products",
	"lootTables",
	"upgrades",
] as const;

type CollectionKey = (typeof collectionKeys)[number];
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

export const mergeSources = (sources: readonly FileSource[]): GameConfig => {
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

export const validatePackage = (value: unknown): GameConfig => {
	try {
		return parseGameConfig(value);
	} catch (error) {
		throw formatZodError(error, "compiled package");
	}
};

export const readJsonSources = async (paths: readonly string[]) => {
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

const createEmptyPackage = (): GameConfig => ({
	version: 1,
	game: undefined as never,
	resources: {},
	assets: {},
	items: {},
	merge: {},
	inputs: {},
	producers: {},
	stashes: {},
	craftRecipes: {},
	products: {},
	lootTables: {},
	upgrades: {},
	startingState: undefined as never,
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
