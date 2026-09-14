import type { FormValues } from "~/item-authoring/schema/FormSchema";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";

export namespace copyItemSectionFn {
	export type Section =
		| "identity"
		| "artwork"
		| "production"
		| "merges"
		| "units"
		| "clock"
		| "action";
}

/** Replaces one authored section while retaining destination identity and enforcing capability exclusions. */
export const copyItemSectionFn = (
	current: FormValues,
	source: ItemSchema.Type,
	section: copyItemSectionFn.Section,
): FormValues => {
	if (current.uid === source.uid) return current;
	switch (section) {
		case "identity":
			return {
				...current,
				title: source.title,
				description: source.description ?? "",
				control: source.control,
				scope: source.scope,
				maxStackSize: current.clock === undefined ? source.maxStackSize : 1,
				maxCount: source.maxCount,
			};
		case "artwork":
			return {
				...current,
				asset: {
					scale: source.asset.scale,
					default: [
						source.asset.default[0],
						source.asset.default[1] ?? "",
					],
				},
			};
		case "production":
			return {
				...current,
				lines: structuredClone(source.lines),
				maxQueueSize: source.maxQueueSize,
				action: source.lines.length > 0 ? undefined : current.action,
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
				...(source.clock === undefined
					? {}
					: {
							action: undefined,
							maxStackSize: 1,
						}),
			};
		case "action":
			return {
				...current,
				action: structuredClone(source.action),
				...(source.action === undefined
					? {}
					: {
							lines: [],
							clock: undefined,
						}),
			};
	}
};
