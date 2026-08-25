import type {
	EditorProjectVersionBinaryDiff,
	EditorProjectVersionDiff,
	EditorProjectVersionValueChange,
} from "~/editor/version/EditorProjectVersion";

const formatValue = (value: unknown) => {
	if (value === undefined) return "—";
	const json = JSON.stringify(value, null, 2);
	return json ?? String(value);
};

const ValueChange = ({ change }: { readonly change: EditorProjectVersionValueChange }) => (
	<div className="grid gap-2 rounded-lg border border-line bg-surface p-3">
		<div className="break-all text-xs font-semibold text-accent">
			{change.path || "Entire item"}
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
						className="rounded-full border border-line bg-surface px-2.5 py-1 text-xs"
					>
						<span className="mr-1 font-semibold capitalize text-accent">
							{change.change}
						</span>
						{change.id}
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
