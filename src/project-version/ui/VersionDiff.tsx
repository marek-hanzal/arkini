import type { ReactNode } from "react";
import { CircleCheckBig } from "lucide-react";

import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";
import type {
	ProjectVersionBinaryDiff,
	ProjectVersionDiff,
	ProjectVersionValueChange,
} from "~/project-version/type/ProjectVersion";
import type { ProjectCompatibilityDiffResult } from "~/project-version/type/ProjectCompatibility";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";
import { Status } from "~/ui/ui/Status";

const formatValueFn = (value: unknown) => {
	if (value === undefined) return "—";
	const json = JSON.stringify(value, null, 2);
	return json ?? String(value);
};

const VersionBump = ({ bump }: { readonly bump?: ProjectCompatibilityDiffResult }) =>
	bump === undefined ? null : (
		<span
			className="shrink-0 rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider data-[ui-bump=major]:border-danger/40 data-[ui-bump=major]:bg-danger/10 data-[ui-bump=major]:text-danger data-[ui-bump=minor]:border-success/40 data-[ui-bump=minor]:bg-success/10 data-[ui-bump=minor]:text-success"
			{...readDataUiFn({
				dataUi: "EditorVersionBump",
				state: {
					bump,
				},
			})}
		>
			{bump} bump
		</span>
	);

const ValueChange = ({
	change,
	title,
}: {
	readonly change: ProjectVersionValueChange;
	readonly title: ReactNode;
}) => (
	<EditorRootCard
		className="gap-2"
		dataUi="EditorVersionChangeCard"
	>
		<h3 className="text-sm font-semibold">{title}</h3>
		<div className="flex items-start justify-between gap-3">
			<div className="min-w-0 break-all text-xs font-semibold text-accent">
				{change.path || "Entire item"}
			</div>
			<VersionBump bump={change.bump} />
		</div>
		<div className="grid gap-2 lg:grid-cols-2">
			<div className="min-w-0">
				<div className="mb-1 text-[0.65rem] font-semibold uppercase tracking-wider text-subtle">
					Before
				</div>
				<pre className="max-h-44 overflow-auto whitespace-pre-wrap break-words text-xs text-muted">
					{formatValueFn(change.before)}
				</pre>
			</div>
			<div className="min-w-0">
				<div className="mb-1 text-[0.65rem] font-semibold uppercase tracking-wider text-subtle">
					After
				</div>
				<pre className="max-h-44 overflow-auto whitespace-pre-wrap break-words text-xs text-foreground">
					{formatValueFn(change.after)}
				</pre>
			</div>
		</div>
	</EditorRootCard>
);

const BinaryChange = ({
	change,
	title,
}: {
	readonly change: ProjectVersionBinaryDiff;
	readonly title: string;
}) => (
	<EditorRootCard
		className="gap-2"
		dataUi="EditorVersionChangeCard"
	>
		<h3 className="text-sm font-semibold">{title}</h3>
		<div className="flex flex-wrap gap-2">
			<span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-xs">
				<span className="font-semibold capitalize text-accent">{change.change}</span>
				{change.id}
				<VersionBump bump={change.bump} />
			</span>
		</div>
	</EditorRootCard>
);

export const VersionDiff = ({ diff }: { readonly diff: ProjectVersionDiff }) =>
	diff.hasChanges ? (
		<div
			className="grid gap-5"
			data-ui="EditorVersionDiff"
		>
			{diff.project.map((change) => (
				<ValueChange
					key={change.path}
					change={change}
					title="Project"
				/>
			))}
			{diff.items.flatMap((item) =>
				item.values.map((change) => (
					<ValueChange
						key={`${item.uid}:${change.path}`}
						change={change}
						title={
							item.change === "changed" ? (
								<>Item {item.uid}</>
							) : (
								<>
									Item {item.uid} ·{" "}
									<span className="capitalize text-accent">{item.change}</span>
								</>
							)
						}
					/>
				)),
			)}
			{diff.resources.map((change) => (
				<BinaryChange
					key={change.id}
					change={change}
					title="Assets"
				/>
			))}
			{diff.scenarios.map((change) => (
				<BinaryChange
					key={change.id}
					change={change}
					title="Board scenarios"
				/>
			))}
		</div>
	) : (
		<Status
			dataUi="EditorVersionDiffIdentical"
			description="No project, item, asset, or Board scenario changes were found."
			icon={CircleCheckBig}
			title="These two states are identical"
		/>
	);
