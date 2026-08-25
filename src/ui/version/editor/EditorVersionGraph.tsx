import { twMerge } from "tailwind-merge";

import type { EditorProjectVersionStatus } from "~/editor/version/EditorProjectVersion";
import type { EditorVersionGraphLayout } from "~/ui/version/editor/layoutEditorVersionGraph";

const laneGap = 22;

const readWorkingCopyState = (status: EditorProjectVersionStatus) =>
	status.currentBaseVersionId === undefined ? "unversioned" : status.dirty ? "dirty" : "clean";

const WorkingCopyPresentation = {
	clean: {
		backgroundClassName: "bg-success/10",
		dotClassName: "bg-success",
		label: "Clean",
		textClassName: "text-success",
	},
	dirty: {
		backgroundClassName: "bg-warning/12",
		dotClassName: "bg-warning",
		label: "Dirty",
		textClassName: "text-warning",
	},
	unversioned: {
		backgroundClassName: "bg-surface-raised/65",
		dotClassName: "bg-muted",
		label: "Unversioned",
		textClassName: "text-muted",
	},
} as const;

const VersionRails = ({
	activeLanes,
	lane,
	laneCount,
	parentLane,
}: {
	readonly activeLanes: ReadonlyArray<number>;
	readonly lane: number;
	readonly laneCount: number;
	readonly parentLane?: number;
}) => {
	const x = (index: number) => 11 + index * laneGap;
	return (
		<svg
			className="h-16 shrink-0 overflow-visible"
			style={{
				width: 18 + laneCount * laneGap,
			}}
			viewBox={`0 0 ${18 + laneCount * laneGap} 64`}
		>
			{activeLanes
				.filter((activeLane) => activeLane !== lane)
				.map((activeLane) => (
					<line
						key={activeLane}
						x1={x(activeLane)}
						x2={x(activeLane)}
						y1="0"
						y2="64"
						className="stroke-line-strong"
						strokeWidth="2"
					/>
				))}
			<line
				x1={x(lane)}
				x2={x(lane)}
				y1="0"
				y2="22"
				className="stroke-accent"
				strokeWidth="2"
			/>
			{parentLane === undefined ? null : (
				<path
					d={`M ${x(lane)} 22 C ${x(lane)} 40, ${x(parentLane)} 40, ${x(parentLane)} 64`}
					className="fill-none stroke-accent"
					strokeWidth="2"
				/>
			)}
			<circle
				cx={x(lane)}
				cy="22"
				r="5"
				className="fill-accent stroke-surface"
				strokeWidth="2"
			/>
		</svg>
	);
};

export const EditorVersionGraph = ({
	layout,
	onSelect,
	onSelectWorkingCopy,
	selectedReference,
	status,
}: {
	readonly layout: EditorVersionGraphLayout;
	readonly onSelect: (versionId: string) => void;
	readonly onSelectWorkingCopy: () => void;
	readonly selectedReference: string;
	readonly status: EditorProjectVersionStatus;
}) => {
	const workingCopy = WorkingCopyPresentation[readWorkingCopyState(status)];
	return (
		<div
			className="grid content-start"
			data-ui="EditorVersionGraph"
		>
			<button
				type="button"
				className={twMerge(
					"flex min-h-16 w-full cursor-pointer items-center border-b border-line/60 px-2 text-left hover:bg-surface-raised",
					workingCopy.backgroundClassName,
					selectedReference === "current" && "bg-accent/10",
				)}
				data-selected={selectedReference === "current" ? true : undefined}
				data-ui="EditorVersionWorkingCopy"
				onClick={onSelectWorkingCopy}
			>
				<div
					className="relative h-16 shrink-0"
					style={{
						width: 18 + layout.laneCount * laneGap,
					}}
				>
					<div
						className={`absolute top-[22px] h-2.5 w-2.5 rounded-full ${workingCopy.dotClassName}`}
						style={{
							left: 6 + layout.workingCopyLane * laneGap,
						}}
					/>
					{status.currentBaseVersionId === undefined ? null : (
						<div
							className="absolute top-8 h-8 w-0.5 bg-line-strong"
							style={{
								left: 10 + layout.workingCopyLane * laneGap,
							}}
						/>
					)}
				</div>
				<div className="min-w-0">
					<div className="font-semibold">Working copy</div>
					<div className={`text-xs font-medium ${workingCopy.textClassName}`}>
						{workingCopy.label}
					</div>
				</div>
			</button>
			{layout.rows.map((row) => (
				<button
					key={row.version.versionId}
					type="button"
					className={twMerge(
						"flex min-h-16 w-full cursor-pointer items-center border-b border-line/60 px-2 text-left hover:bg-surface-raised",
						selectedReference === row.version.versionId && "bg-accent/10",
					)}
					data-selected={
						selectedReference === row.version.versionId ? true : undefined
					}
					onClick={() => onSelect(row.version.versionId)}
				>
					<VersionRails
						activeLanes={row.activeLanes}
						lane={row.lane}
						laneCount={layout.laneCount}
						parentLane={row.parentLane}
					/>
					<div className="min-w-0 flex-1 py-2">
						<div className="truncate font-semibold">{row.version.subject}</div>
						<div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
							<span>{new Date(row.version.createdAtMs).toLocaleString()}</span>
							{row.version.tag === undefined ? null : (
								<span className="rounded-full bg-accent/15 px-2 py-0.5 text-accent">
									{row.version.tag}
								</span>
							)}
							{status.currentBaseVersionId === row.version.versionId ? (
								<span className="text-success">Current base</span>
							) : null}
						</div>
					</div>
				</button>
			))}
		</div>
	);
};
