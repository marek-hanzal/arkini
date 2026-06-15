import { queryOptions } from "@tanstack/react-query";
import type { BoardViewItem } from "~/v0/board/view/BoardViewItemSchema";
import { boardQueryKeys } from "~/v0/board/query/boardQueryKeys";
import { boardViewQueryOptions } from "~/v0/board/query/boardViewQueryOptions";

export namespace boardCellItemQueryOptions {
	export interface Props {
		cellKey: string;
	}
}

export const boardCellItemQueryOptions = ({ cellKey }: boardCellItemQueryOptions.Props) =>
	queryOptions({
		...boardViewQueryOptions(),
		queryKey: boardQueryKeys.view,
		select(board): BoardViewItem | null {
			return board.byCellKey[cellKey] ?? null;
		},
	});
