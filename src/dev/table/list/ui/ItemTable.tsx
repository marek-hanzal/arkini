import {
	flexRender,
	getCoreRowModel,
	getExpandedRowModel,
	getSortedRowModel,
	type ColumnDef,
	type ExpandedState,
	type SortingState,
	useReactTable,
} from "@tanstack/react-table";
import { Fragment, type FC, useMemo, useState } from "react";

import type { ItemSchema } from "~/v1/item/schema/ItemSchema";
import type { GameSchema } from "~/v1/schema/GameSchema";
import { ItemExpandedRow } from "../../detail/ui/ItemExpandedRow";
import { ItemAssetThumbnail } from "./ItemAssetThumbnail";

export namespace ItemTable {
	export interface Props {
		items: ReadonlyArray<ItemSchema.Type>;
		categories: GameSchema.Type["categories"];
	}
}

export const ItemTable: FC<ItemTable.Props> = ({ items, categories }) => {
	const [sorting, setSorting] = useState<SortingState>([
		{
			id: "title",
			desc: false,
		},
	]);
	const [expanded, setExpanded] = useState<ExpandedState>({});
	const columns = useMemo<Array<ColumnDef<ItemSchema.Type>>>(
		() => [
			{
				id: "expand",
				header: () => <span className="sr-only">Expand</span>,
				cell: ({ row }) => (
					<button
						type="button"
						aria-label={
							row.getIsExpanded() ? "Collapse item details" : "Expand item details"
						}
						aria-expanded={row.getIsExpanded()}
						className="grid size-8 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-800 hover:text-white"
						onClick={row.getToggleExpandedHandler()}
					>
						<span className={`transition ${row.getIsExpanded() ? "rotate-90" : ""}`}>
							›
						</span>
					</button>
				),
				size: 48,
				enableSorting: false,
			},
			{
				id: "asset",
				header: "Asset",
				cell: ({ row }) => (
					<ItemAssetThumbnail
						asset={row.original.asset}
						title={row.original.title}
					/>
				),
				size: 72,
				enableSorting: false,
			},
			{
				accessorKey: "title",
				header: "Title",
				cell: ({ row, getValue }) => (
					<div className="min-w-56">
						<p className="font-semibold text-slate-100">{getValue<string>()}</p>
						<p className="mt-1 max-w-xl truncate text-xs text-slate-500">
							{row.original.description}
						</p>
					</div>
				),
			},
			{
				accessorKey: "id",
				header: "ID",
				cell: ({ getValue }) => (
					<span className="font-mono text-xs text-slate-400">{getValue<string>()}</span>
				),
			},
			{
				accessorKey: "type",
				header: "Type",
				cell: ({ getValue }) => (
					<span className="whitespace-nowrap rounded-md border border-violet-900/60 bg-violet-950/40 px-2 py-1 font-mono text-xs text-violet-200">
						{getValue<string>()}
					</span>
				),
			},
			{
				accessorKey: "categoryId",
				header: "Category",
				cell: ({ getValue }) => {
					const categoryId = getValue<string>();
					return (
						<div className="whitespace-nowrap">
							<p className="text-sm text-slate-300">
								{categories[categoryId]?.title ?? "Unknown"}
							</p>
							<p className="mt-0.5 font-mono text-[11px] text-slate-600">
								{categoryId}
							</p>
						</div>
					);
				},
			},
			{
				accessorKey: "scope",
				header: "Scope",
				cell: ({ getValue }) => (
					<span className="font-mono text-xs text-slate-400">{getValue<string>()}</span>
				),
			},
			{
				accessorKey: "maxStackSize",
				header: "Stack",
				cell: ({ getValue }) => (
					<span className="tabular-nums text-sm text-slate-300">
						{getValue<number>()}
					</span>
				),
			},
			{
				id: "tags",
				header: "Tags",
				accessorFn: (item) => item.tags.join(" "),
				cell: ({ row }) => (
					<div className="flex min-w-48 flex-wrap gap-1">
						{row.original.tags.slice(0, 3).map((tag) => (
							<span
								key={tag}
								className="rounded bg-slate-800 px-1.5 py-1 text-[11px] text-slate-400"
							>
								{tag}
							</span>
						))}
						{row.original.tags.length > 3 ? (
							<span className="rounded bg-slate-900 px-1.5 py-1 text-[11px] text-slate-600">
								+{row.original.tags.length - 3}
							</span>
						) : null}
					</div>
				),
			},
		],
		[
			categories,
		],
	);
	const data = useMemo(
		() => Array.from(items),
		[
			items,
		],
	);
	const table = useReactTable({
		data,
		columns,
		state: {
			sorting,
			expanded,
		},
		onSortingChange: setSorting,
		onExpandedChange: setExpanded,
		getRowId: (item) => item.id,
		getRowCanExpand: () => true,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getExpandedRowModel: getExpandedRowModel(),
	});

	return (
		<div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/45 shadow-2xl shadow-black/20">
			<div className="flex items-center justify-between gap-4 border-b border-slate-800 px-4 py-3">
				<p className="text-sm text-slate-400">
					{table.getRowModel().rows.length} visible{" "}
					{table.getRowModel().rows.length === 1 ? "item" : "items"}
				</p>
				<button
					type="button"
					className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-400 transition hover:border-slate-500 hover:text-white"
					onClick={() => table.toggleAllRowsExpanded(false)}
				>
					Collapse all
				</button>
			</div>
			<div className="overflow-x-auto">
				<table className="w-full border-collapse text-left">
					<thead className="bg-slate-950/65">
						{table.getHeaderGroups().map((headerGroup) => (
							<tr key={headerGroup.id}>
								{headerGroup.headers.map((header) => (
									<th
										key={header.id}
										className="whitespace-nowrap border-b border-slate-800 px-3 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"
									>
										{header.isPlaceholder ? null : (
											<button
												type="button"
												disabled={!header.column.getCanSort()}
												className="inline-flex items-center gap-1.5 disabled:cursor-default"
												onClick={header.column.getToggleSortingHandler()}
											>
												{flexRender(
													header.column.columnDef.header,
													header.getContext(),
												)}
												{header.column.getIsSorted() === "asc" ? "↑" : null}
												{header.column.getIsSorted() === "desc"
													? "↓"
													: null}
											</button>
										)}
									</th>
								))}
							</tr>
						))}
					</thead>
					<tbody>
						{table.getRowModel().rows.map((row) => (
							<Fragment key={row.id}>
								<tr className="border-b border-slate-800/80 transition hover:bg-slate-800/35">
									{row.getVisibleCells().map((cell) => (
										<td
											key={cell.id}
											className="px-3 py-3 align-middle"
										>
											{flexRender(
												cell.column.columnDef.cell,
												cell.getContext(),
											)}
										</td>
									))}
								</tr>
								{row.getIsExpanded() ? (
									<tr className="border-b border-slate-800 bg-slate-950/55">
										<td colSpan={row.getVisibleCells().length}>
											<ItemExpandedRow item={row.original} />
										</td>
									</tr>
								) : null}
							</Fragment>
						))}
					</tbody>
				</table>
			</div>
			{table.getRowModel().rows.length === 0 ? (
				<div className="px-6 py-16 text-center text-sm text-slate-500">
					No item survived the search. Fuse tried. The catalog declined.
				</div>
			) : null}
		</div>
	);
};
