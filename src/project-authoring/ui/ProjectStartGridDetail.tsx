import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { EditorItemThumbnail } from "~/authoring-form/ui/EditorItemThumbnail";
import type { ProjectStartGridCell } from "~/project-authoring/type/ProjectStartGridCell";

export const ProjectStartGridDetail = ({
	cells,
	height,
	items,
	width,
}: {
	readonly cells: ReadonlyArray<ProjectStartGridCell>;
	readonly height: number;
	readonly items: Readonly<Record<string, ItemSchema.Type>>;
	readonly width: number;
}) => {
	const cellsByPosition = new Map(
		cells.map((cell) => [
			`${cell.x}:${cell.y}`,
			cell,
		]),
	);
	const positions = Array.from(
		{
			length: Math.max(0, width * height),
		},
		(_, index) => ({
			x: index % Math.max(1, width),
			y: Math.floor(index / Math.max(1, width)),
		}),
	);
	return (
		<div
			className="max-w-full overflow-auto"
			data-ui="EditorProjectStartGridDetail"
		>
			<div
				className="mx-auto grid w-max gap-1.5"
				style={{
					gridTemplateColumns: `repeat(${Math.max(1, width)}, 4.5rem)`,
				}}
			>
				{positions.map(({ x, y }) => {
					const cell = cellsByPosition.get(`${x}:${y}`);
					const item = cell === undefined ? undefined : items[cell.itemId];
					return (
						<div
							className="relative grid size-[4.5rem] place-items-center rounded-lg border border-line bg-surface/70"
							key={`${x}:${y}`}
							title={item?.title || item?.id}
						>
							{item === undefined ? null : (
								<EditorItemThumbnail
									className="size-14 border-0 bg-transparent"
									resourceIds={item.asset.default}
									size="sm"
								/>
							)}
							{cell === undefined ? null : (
								<span className="absolute right-1 bottom-1 rounded-md border border-line-strong bg-surface-raised/95 px-1.5 py-0.5 font-mono text-[0.65rem] font-bold text-foreground">
									×{cell.quantity}
								</span>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
};
