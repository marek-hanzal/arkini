import type { RectLike } from "~/play/types";
import { paddingBoxRect } from "~/shared/util/paddingBoxRect";
import { queryElement } from "~/shared/util/queryElement";

export function queryPaddingBoxRect(selector: string): RectLike | undefined {
	const element = queryElement(selector);
	return element ? paddingBoxRect(element) : undefined;
}
