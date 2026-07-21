import { isLineOwnerItem } from "~/engine/line/read/isLineOwnerItem";
import { readLineOwnerLines } from "~/engine/line/read/readLineOwnerLines";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace readRuntimeItemPrimaryAction {
	export type Result =
		| {
				readonly kind: "none";
		  }
		| {
				readonly kind: "open-lines";
		  }
		| {
				readonly kind: "start-default-line";
				readonly lineId: string;
		  };

	export interface Props {
		readonly item: RuntimeItemSchema.Type;
		readonly runtime: RuntimeSchema.Type;
	}
}

/** Resolves the canonical single-click action of one exact live item. */
export const readRuntimeItemPrimaryAction = ({
	item,
	runtime,
}: readRuntimeItemPrimaryAction.Props): readRuntimeItemPrimaryAction.Result => {
	if (!isLineOwnerItem(item.item)) {
		return {
			kind: "none",
		};
	}
	const defaultLineId = runtime.defaultLineByOwnerItemId?.[item.id];
	if (
		defaultLineId !== undefined &&
		readLineOwnerLines(item.item).some((line) => line.id === defaultLineId)
	) {
		return {
			kind: "start-default-line",
			lineId: defaultLineId,
		};
	}
	return {
		kind: "open-lines",
	};
};
