import { Effect } from "effect";

import { TranslationDefaultLocale } from "~/translation/constant/TranslationDefaultLocale";
import { createTranslatorFn } from "~/translation/fn/createTranslatorFn";
import { resolveTranslationLocaleFn } from "~/translation/fn/resolveTranslationLocaleFn";
import { TranslationListSchema } from "~/translation/schema/TranslationListSchema";

const TranslationCatalogImports = import.meta.glob<unknown>("../*.yaml", {
	import: "default",
});

export namespace loadTranslatorFx {
	export interface Props {
		readonly preferredLocales: readonly string[];
	}

	export interface Result {
		readonly locale: string;
		readonly translator: createTranslatorFn.Translator;
	}
}

const readCatalogLocaleFn = (path: string): string | undefined => {
	const filename = path.split("/").at(-1);
	if (filename === undefined || !filename.endsWith(".yaml")) return undefined;
	const candidate = filename.slice(0, -".yaml".length);
	try {
		return Intl.getCanonicalLocales(candidate)[0];
	} catch {
		return undefined;
	}
};

/** Selects and loads one bundled locale catalog after Electron reports OS preferences. */
export const loadTranslatorFx = Effect.fn("loadTranslatorFx")(function* ({
	preferredLocales,
}: loadTranslatorFx.Props) {
	const catalogs = new Map<string, () => Promise<unknown>>();
	for (const [path, loadFn] of Object.entries(TranslationCatalogImports)) {
		const locale = readCatalogLocaleFn(path);
		if (locale === undefined) {
			return yield* Effect.die(`Translation catalog path is not a locale: ${path}`);
		}
		if (catalogs.has(locale)) {
			return yield* Effect.die(`Duplicate translation locale: ${locale}`);
		}
		catalogs.set(locale, loadFn);
	}
	const locale = resolveTranslationLocaleFn({
		availableLocales: Array.from(catalogs.keys()),
		fallbackLocale: TranslationDefaultLocale,
		preferredLocales,
	});
	if (locale === undefined) {
		return yield* Effect.die(
			`Default translation catalog is missing: ${TranslationDefaultLocale}`,
		);
	}
	const loadFn = catalogs.get(locale);
	if (loadFn === undefined) {
		return yield* Effect.die(`Translation catalog is missing: ${locale}`);
	}
	const source = yield* Effect.promise(loadFn);
	const translations = TranslationListSchema.parse(source);
	return {
		locale,
		translator: createTranslatorFn({
			translations,
		}),
	} satisfies loadTranslatorFx.Result;
});
