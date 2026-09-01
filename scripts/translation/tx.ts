import { dirname, extname, join } from "node:path";
import { Console, Effect, FileSystem } from "effect";
import * as ts from "typescript";
import { parse, stringify } from "yaml";

import { TranslationOutOfSyncError } from "./error/TranslationOutOfSyncError";
import { TranslationSyncError } from "./error/TranslationSyncError";
import { TranslationListSchema } from "~/translation/schema/TranslationListSchema";
import type { TranslationSource } from "~/translation/type/TranslationSource";

export namespace tx {
	export interface Props {
		readonly locales: readonly string[];
		readonly mode: "check" | "sync";
		readonly packages: readonly string[];
		readonly sourceDirectory: string;
		readonly sources: TranslationSource.Sources;
	}

	export interface Result {
		readonly changed: readonly string[];
		readonly files: number;
		readonly translations: number;
	}
}

const readSourceFileNamesFx = Effect.fn("readSourceFileNamesFx")((packagePath: string) =>
	Effect.try({
		try: () => {
			const configPath = ts.findConfigFile(packagePath, ts.sys.fileExists, "tsconfig.json");
			if (configPath === undefined) {
				throw new Error(`Missing tsconfig.json below ${packagePath}.`);
			}
			const config = ts.readConfigFile(configPath, ts.sys.readFile);
			if (config.error !== undefined) {
				throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, "\n"));
			}
			const parsed = ts.parseJsonConfigFileContent(
				config.config,
				ts.sys,
				dirname(configPath),
			);
			if (parsed.errors.length > 0) {
				throw new Error(
					parsed.errors
						.map((error) => ts.flattenDiagnosticMessageText(error.messageText, "\n"))
						.join("\n"),
				);
			}
			return parsed.fileNames.filter(
				(fileName) => /[.]tsx?$/.test(fileName) && !/[.]d[.]ts$/.test(fileName),
			);
		},
		catch: (cause) =>
			new TranslationSyncError({
				cause,
				message: `Translation source discovery failed below ${packagePath}.`,
				operation: "discover",
				path: packagePath,
			}),
	}),
);

const readLiteralKeysFn = (node: ts.Node): readonly string[] => {
	if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
		return node.text.length === 0
			? []
			: [
					node.text,
				];
	}
	if (ts.isTemplateExpression(node)) return [];
	const keys: string[] = [];
	ts.forEachChild(node, (child) => {
		keys.push(...readLiteralKeysFn(child));
	});
	return keys;
};

const readSourceFileFx = Effect.fn("readSourceFileFx")(function* (fileName: string) {
	const fileSystem = yield* FileSystem.FileSystem;
	const content = yield* fileSystem.readFileString(fileName).pipe(
		Effect.mapError(
			(cause) =>
				new TranslationSyncError({
					cause,
					message: `Translation source ${fileName} could not be read.`,
					operation: "read",
					path: fileName,
				}),
		),
	);
	return ts.createSourceFile(
		fileName,
		content,
		ts.ScriptTarget.Latest,
		true,
		extname(fileName) === ".tsx" ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
	);
});

const readJsxTagNameFn = (node: ts.JsxOpeningLikeElement): string | undefined =>
	ts.isIdentifier(node.tagName) ? node.tagName.text : undefined;

const readTranslationKeysFn = (
	sourceFile: ts.SourceFile,
	sources: TranslationSource.Sources,
): readonly string[] => {
	const keys = new Set<string>();
	const jsxSources = new Map(
		sources.jsx.map((source) => [
			source.name,
			source.attr,
		]),
	);
	const functionSources = new Set(sources.functions.map((source) => source.name));
	const objectSources = new Set(
		sources.objects.map((source) => `${source.object}.${source.name}`),
	);
	const visitFn = (node: ts.Node): void => {
		if (ts.isJsxAttribute(node)) {
			const tagName = readJsxTagNameFn(node.parent.parent);
			const attrName = node.name.getText(sourceFile);
			if (tagName !== undefined && jsxSources.get(tagName) === attrName) {
				if (node.initializer !== undefined) {
					for (const key of readLiteralKeysFn(node.initializer)) keys.add(key);
				}
			}
		}
		if (ts.isCallExpression(node) && node.arguments[0] !== undefined) {
			const expression = node.expression;
			const directMatch = ts.isIdentifier(expression) && functionSources.has(expression.text);
			const objectMatch =
				ts.isPropertyAccessExpression(expression) &&
				ts.isIdentifier(expression.expression) &&
				objectSources.has(`${expression.expression.text}.${expression.name.text}`);
			if (directMatch || objectMatch) {
				for (const key of readLiteralKeysFn(node.arguments[0])) keys.add(key);
			}
		}
		ts.forEachChild(node, visitFn);
	};
	visitFn(sourceFile);
	return Array.from(keys);
};

const reconcileTranslationsFn = (
	current: TranslationListSchema.Type,
	liveKeys: ReadonlySet<string>,
): TranslationListSchema.Type => {
	const reconciled: TranslationListSchema.Type = {};
	for (const key of Array.from(
		new Set([
			...Object.keys(current),
			...liveKeys,
		]),
	).sort()) {
		const entry = current[key];
		if (liveKeys.has(key)) {
			reconciled[key] = entry ?? {
				value: key,
			};
		} else if (entry?.dynamic === true) {
			reconciled[key] = entry;
		}
	}
	return reconciled;
};

const readOptionalFileFx = Effect.fn("readOptionalFileFx")(function* (path: string) {
	const fileSystem = yield* FileSystem.FileSystem;
	return yield* Effect.gen(function* () {
		return (yield* fileSystem.exists(path))
			? yield* fileSystem.readFileString(path)
			: undefined;
	}).pipe(
		Effect.mapError(
			(cause) =>
				new TranslationSyncError({
					cause,
					message: `Translation catalog ${path} could not be read.`,
					operation: "read",
					path,
				}),
		),
	);
});

const writeFileFx = Effect.fn("writeFileFx")(function* (path: string, content: string) {
	const fileSystem = yield* FileSystem.FileSystem;
	yield* Effect.gen(function* () {
		yield* fileSystem.makeDirectory(dirname(path), {
			recursive: true,
		});
		yield* fileSystem.writeFileString(path, content);
	}).pipe(
		Effect.mapError(
			(cause) =>
				new TranslationSyncError({
					cause,
					message: `Translation catalog ${path} could not be written.`,
					operation: "write",
					path,
				}),
		),
	);
});

/** Extracts literal keys and reconciles locale catalogs without owning runtime loading. */
export const tx = Effect.fn("tx")(function* ({
	locales,
	mode,
	packages,
	sourceDirectory,
	sources,
}: tx.Props) {
	const packageFileNames = yield* Effect.forEach(packages, readSourceFileNamesFx);
	const fileNames = Array.from(new Set(packageFileNames.flat())).sort();
	const sourceFiles = yield* Effect.forEach(fileNames, readSourceFileFx, {
		concurrency: 16,
	});
	const liveKeys = new Set(
		sourceFiles.flatMap((sourceFile) => readTranslationKeysFn(sourceFile, sources)),
	);
	const catalogs: Array<{
		readonly current: string | undefined;
		readonly expected: string;
		readonly path: string;
	}> = [];
	for (const locale of locales) {
		const path = join(sourceDirectory, `${locale}.yaml`);
		const current = yield* readOptionalFileFx(path);
		const parsed = yield* Effect.try({
			try: () => TranslationListSchema.parse(parse(current ?? "{}")),
			catch: (cause) =>
				new TranslationSyncError({
					cause,
					message: `Translation catalog ${path} is invalid.`,
					operation: "parse",
					path,
				}),
		});
		catalogs.push({
			current,
			expected: stringify(reconcileTranslationsFn(parsed, liveKeys), {
				lineWidth: 0,
			}),
			path,
		});
	}
	const changed = catalogs
		.filter(({ current, expected }) => current !== expected)
		.map(({ path }) => path);
	if (mode === "check" && changed.length > 0) {
		return yield* Effect.fail(
			new TranslationOutOfSyncError({
				paths: changed,
			}),
		);
	}
	if (mode === "sync") {
		for (const catalog of catalogs) {
			if (catalog.current !== catalog.expected) {
				yield* writeFileFx(catalog.path, catalog.expected);
			}
		}
	}
	yield* Console.log(
		`${mode === "sync" ? "Synchronized" : "Checked"} ${liveKeys.size} translation keys across ${fileNames.length} source files.`,
	);
	return {
		changed,
		files: fileNames.length,
		translations: liveKeys.size,
	} satisfies tx.Result;
});
