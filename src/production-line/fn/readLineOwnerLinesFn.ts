import type { narrowLineOwnerItemFn } from "./narrowLineOwnerItemFn";

/** Reads the canonical authored lines owned by one exact line-capable item. */
export const readLineOwnerLinesFn = (item: narrowLineOwnerItemFn.Result) => item.lines;
