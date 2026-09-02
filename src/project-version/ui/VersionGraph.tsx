import { RotateCcw } from "lucide-react";

import type { ProjectVersionStatus } from "~/project-version/type/ProjectVersion";
import type { VersionGraphLayout } from "~/project-version/fn/layoutVersionGraphFn";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";
import { LinkButton } from "~/ui/ui/LinkButton";

const laneGap = 22;

const readWorkingCopyStateFn = (status: ProjectVersionStatus) =>
	status.currentBaseVersionId === undefined ? "unversioned" : status.dirty ? "dirty" : "clean";

const WorkingCopyLabel = {
	clean: "Clean",
	dirty: "Dirty",
	unversioned: "Unversioned",
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
	const xFn = (index: number) => 11 + index * laneGap;
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
						x1={xFn(activeLane)}
						x2={xFn(activeLane)}
						y1="0"
						y2="64"
						className="stroke-line-strong"
						strokeWidth="2"
					/>
				))}
			<line
				x1={xFn(lane)}
				x2={xFn(lane)}
				y1="0"
				y2="22"
				className="stroke-accent"
				strokeWidth="2"
			/>
			{parentLane === undefined ? null : (
				<path
					d={`M ${xFn(lane)} 22 C ${xFn(lane)} 40, ${xFn(parentLane)} 40, ${xFn(parentLane)} 64`}
					className="fill-none stroke-accent"
					strokeWidth="2"
				/>
			)}
			<circle
				cx={xFn(lane)}
				cy="22"
				r="5"
				className="fill-accent stroke-surface"
				strokeWidth="2"
			/>
		</svg>
	);
};

export const VersionGraph = ({
	layout,
	onRestoreFn,
	onSelectFn,
	onSelectWorkingCopyFn,
	restorePending,
	selectedReference,
	status,
}: {
	readonly layout: VersionGraphLayout;
	readonly onRestoreFn: (versionId: string) => void;
	readonly onSelectFn: (versionId: string) => void;
	readonly onSelectWorkingCopyFn: () => void;
	readonly restorePending: boolean;
	readonly selectedReference: string;
	readonly status: ProjectVersionStatus;
}) => {
	const workingCopyStatus = readWorkingCopyStateFn(status);
	return (
		<div
			className="grid content-start"
			data-ui="EditorVersionGraph"
		>
			<button
				type="button"
				className="group flex min-h-16 w-full cursor-pointer items-center border-b border-line/60 px-2 text-left enabled:hover:bg-surface-raised data-[ui-selected=true]:bg-accent/10! data-[ui-status=clean]:bg-success/10 data-[ui-status=dirty]:bg-warning/12 data-[ui-status=unversioned]:bg-surface-raised/65"
				onClick={onSelectWorkingCopyFn}
				{...readDataUiFn({
					dataUi: "EditorVersionWorkingCopy",
					state: {
						selected: selectedReference === "current",
						status: workingCopyStatus,
					},
				})}
			>
				<div
					className="relative h-16 shrink-0"
					style={{
						width: 18 + layout.laneCount * laneGap,
					}}
				>
					<div
						className="absolute top-[22px] h-2.5 w-2.5 rounded-full group-data-[ui-status=clean]:bg-success group-data-[ui-status=dirty]:bg-warning group-data-[ui-status=unversioned]:bg-muted"
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
					<div className="text-xs font-medium group-data-[ui-status=clean]:text-success group-data-[ui-status=dirty]:text-warning group-data-[ui-status=unversioned]:text-muted">
						{WorkingCopyLabel[workingCopyStatus]}
					</div>
				</div>
			</button>
			{layout.rows.map((row) => (
				<div
					key={row.version.versionId}
					className="group flex min-h-16 w-full items-center border-b border-line/60 hover:bg-surface-raised data-[ui-selected=true]:bg-accent/10"
					{...readDataUiFn({
						dataUi: "EditorVersionRow",
						state: {
							selected: selectedReference === row.version.versionId,
						},
					})}
				>
					<button
						type="button"
						className="flex min-h-16 min-w-0 flex-1 cursor-pointer items-center px-2 text-left"
						onClick={() => onSelectFn(row.version.versionId)}
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
					<LinkButton
						className="invisible mr-3 inline-flex shrink-0 items-center gap-1.5 group-hover:visible"
						cursorIntent={restorePending ? "progress" : undefined}
						data-ui="EditorVersionRestore"
						disabled={restorePending}
						onClick={() => onRestoreFn(row.version.versionId)}
					>
						<RotateCcw className="size-4" />
						Restore
					</LinkButton>
				</div>
			))}
		</div>
	);
};
