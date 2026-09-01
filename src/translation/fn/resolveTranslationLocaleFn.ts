import { match } from "@formatjs/intl-localematcher";

export namespace resolveTranslationLocaleFn {
	export interface Props {
		readonly availableLocales: readonly string[];
		readonly fallbackLocale: string;
		readonly preferredLocales: readonly string[];
	}
}

const canonicalizeLocalesFn = (locales: readonly string[]): readonly string[] => {
	const canonicalLocales: string[] = [];
	for (const locale of locales) {
		try {
			for (const canonicalLocale of Intl.getCanonicalLocales(locale)) {
				if (!canonicalLocales.includes(canonicalLocale))
					canonicalLocales.push(canonicalLocale);
			}
		} catch {
			// OS preferences are outside Arkini's control; malformed entries cannot win negotiation.
		}
	}
	return canonicalLocales;
};

/** Negotiates one available BCP-47 locale without owning catalog loading. */
export const resolveTranslationLocaleFn = ({
	availableLocales,
	fallbackLocale,
	preferredLocales,
}: resolveTranslationLocaleFn.Props): string | undefined => {
	const available = canonicalizeLocalesFn(availableLocales);
	const [fallback] = canonicalizeLocalesFn([
		fallbackLocale,
	]);
	if (fallback === undefined || !available.includes(fallback)) return undefined;
	const preferred = canonicalizeLocalesFn(preferredLocales);
	try {
		return match(preferred, available, fallback, {
			algorithm: "best fit",
		});
	} catch {
		return fallback;
	}
};
