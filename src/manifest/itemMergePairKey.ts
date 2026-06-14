import type { manifestId } from "./manifestId";

export function itemMergePairKey(first: itemMergePairKey.Part, second: itemMergePairKey.Part) {
	return [
		first,
		second,
	]
		.sort()
		.join("+");
}

export namespace itemMergePairKey {
	export type Part = manifestId.Item | string;
}
