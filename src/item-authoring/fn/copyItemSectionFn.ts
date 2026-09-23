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
	switch (section) {
		case "identity":
			return {
				...current,
				title: source.title,
				description: source.description ?? "",
				ui: source.ui,
				music: source.music,
			};
		case "artwork":
			return {
				...current,
				artwork: {
					scale: source.artwork.scale,
					default: [
						source.artwork.default[0],
						source.artwork.default[1] ?? "",
					],
				},
			};
		case "production":
			return {
				...current,
				lines: structuredClone([
					...productionLines,
				]),
				maxQueueSize: source.maxQueueSize,
			};
		case "merges":
			return {
				...current,
				merge: structuredClone(source.merge),
			};
		case "units":
			return {
				...current,
				units: structuredClone(source.units),
			};
		case "clock":
			return {
				...current,
				clock: structuredClone(source.clock),
			};
	}
};
