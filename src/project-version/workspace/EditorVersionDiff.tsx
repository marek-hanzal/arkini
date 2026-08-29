import type {
	EditorProjectVersionBinaryDiff,
	EditorProjectVersionDiff,
	EditorProjectVersionValueChange,
} from "~/project-version/EditorProjectVersion";
import type { EditorProjectCompatibilityDiffResult } from "~/project-version/EditorProjectCompatibility";

const formatValue = (value: unknown) => {
	if (value === undefined) return "—";
	const json = JSON.stringify(value, null, 2);
	return json ?? String(value);
};

const VersionBump = ({ bump }: { readonly bump?: EditorProjectCompatibilityDiffResult }) =>
	bump === undefined ? null : (
		<span
			className={`shrink-0 rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider ${
				bump === "major"
					? "border-danger/40 bg-danger/10 text-danger"
					: "border-success/40 bg-success/10 text-success"
			}`}
			data-bump={bump}
		>
			{bump} bump
		</span>
	);

const ValueChange = ({ change }: { readonly change: EditorProjectVersionValueChange }) => (
	<div className="grid gap-2 rounded-lg border border-line bg-surface p-3">
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
					{formatValue(change.before)}
				</pre>
			</div>
			<div className="min-w-0">
				<div className="mb-1 text-[0.65rem] font-semibold uppercase tracking-wider text-subtle">
					After
				</div>
				<pre className="max-h-44 overflow-auto whitespace-pre-wrap break-words text-xs text-foreground">
					{formatValue(change.after)}
				</pre>
			</div>
		</div>
	</div>
);

const BinaryChanges = ({
	changes,
	title,
}: {
	readonly changes: ReadonlyArray<EditorProjectVersionBinaryDiff>;
	readonly title: string;
}) =>
	changes.length === 0 ? null : (
		<section className="grid gap-2">
			<h4 className="text-sm font-semibold">{title}</h4>
			<div className="flex flex-wrap gap-2">
				{changes.map((change) => (
					<span
						key={change.id}
						className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-xs"
					>
						<span className="font-semibold capitalize text-accent">
							{change.change}
						</span>
						{change.id}
						<VersionBump bump={change.bump} />
					</span>
				))}
			</div>
		</section>
	);

export const EditorVersionDiff = ({ diff }: { readonly diff: EditorProjectVersionDiff }) =>
	diff.hasChanges ? (
		<div
			className="grid gap-4"
			data-ui="EditorVersionDiff"
		>
			{diff.project.length === 0 ? null : (
				<section className="grid gap-2">
					<h4 className="text-sm font-semibold">Project</h4>
					{diff.project.map((change) => (
						<ValueChange
							key={change.path}
							change={change}
						/>
					))}
				</section>
			)}
			{diff.items.map((item) => (
				<section
					key={item.uid}
					className="grid gap-2"
				>
					<h4 className="text-sm font-semibold">
						Item {item.uid} ·{" "}
						<span className="capitalize text-accent">{item.change}</span>
					</h4>
					{item.values.map((change) => (
						<ValueChange
							key={change.path}
							change={change}
						/>
					))}
				</section>
			))}
			<BinaryChanges
				title="Assets"
				changes={diff.resources}
			/>
			<BinaryChanges
				title="Board scenarios"
				changes={diff.scenarios}
			/>
		</div>
	) : (
		<p className="rounded-lg bg-surface p-3 text-sm text-muted">
			These two states are identical.
		</p>
	);
