import type { RectLike } from "~/play/types";
import { queryElement } from "~/shared/util/queryElement";

export function queryRect(selector: string): RectLike | undefined {
	return queryElement(selector)?.getBoundingClientRect();
}
