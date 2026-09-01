import { dirname, extname, join } from "node:path";
import { Console, Effect, FileSystem } from "effect";
import * as ts from "typescript";
import { parse, stringify } from "yaml";

import { TranslationListSchema } from "~/translation/schema/TranslationListSchema";
import type { TranslationSchema } from "~/translation/schema/TranslationSchema";
import type { TranslationSource } from "~/translation/type/TranslationSource";

export namespace tx {
	export interface RuntimeOutput {
		readonly locale: string;
		readonly path: string;
	}

	export interface Props {
		readonly locales: readonly string[];
		readonly mode: "check" | "sync";
		readonly packages: readonly string[];
		readonly runtimeOutput: RuntimeOutput;
		readonly sourceDirectory: string;
		readonly sources: TranslationSource.Sources;
	}

	export interface Result {
		readonly changed: readonly string[];
		readonly files: number;
		readonly translations: number;
	}
}

class TranslationOutOfSyncError extends Error {
	readonly paths: readonly string[];

	constructor(paths: readonly string[]) {
		super(`Translation sources are out of sync: ${paths.join(", ")}`);
		this.name = "TranslationOutOfSyncError";
		this.paths = paths;
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
			const fileNames = parsed.fileNames.filter(
				(fileName) => /[.]tsx?$/.test(fileName) && !/[.]d[.]ts$/.test(fileName),
			);
			if (fileNames.length === 0) {
				throw new Error(
					`No translation source files were discovered below ${packagePath}.`,
				);
			}
			return fileNames;
		},
		catch: (cause) =>
			new Error(
				`Translation source discovery failed below ${packagePath}: ${cause instanceof Error ? cause.message : String(cause)}`,
				{
					cause,
				},
			),
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

const parseSourceFileFx = Effect.fn("parseSourceFileFx")(function* (
	fileName: string,
	content: string,
) {
	const scriptKind = extname(fileName) === ".tsx" ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
	const diagnostics = ts
		.transpileModule(content, {
			compilerOptions: {
				jsx: ts.JsxEmit.ReactJSX,
				target: ts.ScriptTarget.Latest,
			},
			fileName,
			reportDiagnostics: true,
		})
		.diagnostics?.filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error);
	if (diagnostics !== undefined && diagnostics.length > 0) {
		return yield* Effect.fail(
			new Error(
				`Translation source ${fileName} cannot be parsed:\n${diagnostics
					.map((diagnostic) =>
						ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
					)
					.join("\n")}`,
			),
		);
	}
	return ts.createSourceFile(fileName, content, ts.ScriptTarget.Latest, true, scriptKind);
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

const renderRuntimeTranslationsFn = (translations: TranslationListSchema.Type): string => {
	const entries: TranslationSchema.Type[] = Object.entries(translations).map(([key, entry]) => ({
		key,
		...entry,
	}));
	const renderedEntries = entries
		.map(
			(entry) =>
				`\t{\n\t\tkey: ${JSON.stringify(entry.key)},\n\t\tvalue: ${JSON.stringify(entry.value)},\n${entry.dynamic === true ? "\t\tdynamic: true,\n" : ""}\t},`,
		)
		.join("\n");
	return `// Generated by \`argc translations:sync\`; edit src/translation/en.yaml instead.\nimport type { TranslationSchema } from "~/translation/schema/TranslationSchema";\n\nexport const EnglishTranslations = [\n${renderedEntries}\n] as const satisfies readonly TranslationSchema.Type[];\n`;
};

const readOptionalFileFx = Effect.fn("readOptionalFileFx")(function* (path: string) {
	const fileSystem = yield* FileSystem.FileSystem;
	return (yield* fileSystem.exists(path)) ? yield* fileSystem.readFileString(path) : undefined;
});

/** Offline configurable translation extraction, reconciliation and garbage collection library. */
export const tx = Effect.fn("tx")(function* ({
	locales,
	mode,
	packages,
	runtimeOutput,
	sourceDirectory,
	sources,
}: tx.Props) {
	if (packages.length === 0) {
		return yield* Effect.fail(
			new Error("At least one translation source package is required."),
		);
	}
	if (!locales.includes(runtimeOutput.locale)) {
		return yield* Effect.die(
			new Error(`Runtime locale ${runtimeOutput.locale} is not configured.`),
		);
	}
	const packageFileNames = yield* Effect.forEach(packages, readSourceFileNamesFx);
	const fileNames = Array.from(new Set(packageFileNames.flat())).sort();
	const fileSystem = yield* FileSystem.FileSystem;
	const sourceFiles = yield* Effect.forEach(
		fileNames,
		(fileName) =>
			fileSystem
				.readFileString(fileName)
				.pipe(Effect.flatMap((content) => parseSourceFileFx(fileName, content))),
		{
			concurrency: 16,
		},
	);
	const liveKeys = new Set(
		sourceFiles.flatMap((sourceFile) => readTranslationKeysFn(sourceFile, sources)),
	);
	const expectedByPath = new Map<string, string>();
	let runtimeTranslations: TranslationListSchema.Type | undefined;
	for (const locale of locales) {
		const path = join(sourceDirectory, `${locale}.yaml`);
		const currentContent = yield* readOptionalFileFx(path);
		const current = yield* Effect.try({
			try: () => TranslationListSchema.parse(parse(currentContent ?? "{}")),
			catch: (cause) =>
				new Error(`Translation source ${path} is invalid.`, {
					cause,
				}),
		});
		const reconciled = reconcileTranslationsFn(current, liveKeys);
		expectedByPath.set(
			path,
			stringify(reconciled, {
				lineWidth: 0,
			}),
		);
		if (locale === runtimeOutput.locale) runtimeTranslations = reconciled;
	}
	if (runtimeTranslations === undefined) {
		return yield* Effect.die(new Error("Runtime translations were not reconciled."));
	}
	expectedByPath.set(runtimeOutput.path, renderRuntimeTranslationsFn(runtimeTranslations));
	const changed: string[] = [];
	for (const [path, expected] of expectedByPath) {
		if ((yield* readOptionalFileFx(path)) !== expected) changed.push(path);
	}
	if (mode === "check" && changed.length > 0) {
		return yield* Effect.fail(new TranslationOutOfSyncError(changed));
	}
	if (mode === "sync") {
		for (const path of changed) {
			const expected = expectedByPath.get(path);
			if (expected === undefined) {
				return yield* Effect.die(
					new Error(`Missing reconciled translation output for ${path}.`),
				);
			}
			yield* fileSystem.makeDirectory(dirname(path), {
				recursive: true,
			});
			yield* fileSystem.writeFileString(path, expected);
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
