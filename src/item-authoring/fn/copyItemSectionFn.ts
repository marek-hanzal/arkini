import { match } from "ts-pattern";
import type { LineSchema } from "~/production-line/schema/LineSchema";
import type { FormValues } from "~/item-authoring/schema/FormSchema";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";

export namespace copyItemSectionFn {
	export type Section = "identity" | "artwork" | "production" | "merges" | "units" | "clock";
}

/** Replaces one section; the caller supplies freshly identified production lines for copying. */
export const copyItemSectionFn = (
	current: FormValues,
	source: ItemSchema.Type,
	section: copyItemSectionFn.Section,
	productionLines: readonly LineSchema.Type[],
): FormValues => {
	if (current.uid === source.uid) return current;
	return match(section)
		.returnType<FormValues>()
		.with("identity", () => ({
			...current,
			title: source.title,
			description: source.description ?? "",
			ui: source.ui,
			music: source.music,
		}))
		.with("artwork", () => ({
			...current,
			artwork: {
				scale: source.artwork.scale,
				default: [
					source.artwork.default[0],
					source.artwork.default[1] ?? "",
				],
			},
		}))
		.with("production", () => ({
			...current,
			lines: structuredClone([
				...productionLines,
			]),
			maxQueueSize: source.maxQueueSize,
		}))
		.with("merges", () => ({
			...current,
			merge: structuredClone(source.merge),
		}))
		.with("units", () => ({
			...current,
			units: structuredClone(source.units),
		}))
		.with("clock", () => ({
			...current,
			clock: structuredClone(source.clock),
		}))
		.exhaustive();
};
