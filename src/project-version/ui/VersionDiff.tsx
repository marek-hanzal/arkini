import type { ReactNode } from "react";
import { CircleCheckBig } from "lucide-react";

import { EditorAssetThumbnail } from "~/authoring-form/ui/EditorAssetThumbnail";
import { DetailReference } from "~/item-authoring/ui/DetailReference";
import { useItemByUid } from "~/item-authoring/ui/useItemByUid";
import type {
	ProjectVersionBinaryDiff,
	ProjectVersionDiff,
	ProjectVersionItemDiff,
	ProjectVersionValueChange,
} from "~/project-version/type/ProjectVersion";
import type { ProjectCompatibilityDiffResult } from "~/project-version/type/ProjectCompatibility";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";
import { Status } from "~/ui/ui/Status";

/** Keeps generic string diffs from being mistaken for project asset references. */
const projectAssetReferenceKeys = new Set([
	"hero",
	"avatar-01",
	"avatar-02",
	"avatar-03",
	"avatar-04",
	"avatar-05",
	"avatar-06",
	"avatar-07",
]);
const itemAssetReferenceKeys = new Set([
	"default",
	"sources",
]);

const readAssetReferenceIdsFn = (path: string, value: unknown) => {
	const [owner, key, index, extra] = path.split(".");
	if (key === undefined || extra !== undefined) return undefined;
	if (owner === "resources")
		return index === undefined &&
			projectAssetReferenceKeys.has(key) &&
			typeof value === "string"
			? [
					value,
				]
			: undefined;
	if (owner !== "asset" || !itemAssetReferenceKeys.has(key)) return undefined;
	if (index === undefined)
		return Array.isArray(value) && value.every((candidate) => typeof candidate === "string")
			? [
					...value,
				]
			: undefined;
	const numericIndex = Number(index);
	return Number.isInteger(numericIndex) &&
		numericIndex >= 0 &&
		String(numericIndex) === index &&
		typeof value === "string"
		? [
				value,
			]
		: undefined;
};

const formatValueFn = (value: unknown) => {
	if (value === undefined) return "—";
	if (typeof value === "string") return value;
	const json = JSON.stringify(value, null, 2);
	return json ?? String(value);
};

const DiffValue = ({
	path,
	side,
	value,
}: {
	readonly path: string;
	readonly side: "after" | "before";
	readonly value: unknown;
}) => {
	const assetReferenceIds = readAssetReferenceIdsFn(path, value);
	return assetReferenceIds === undefined ? (
		<code
			className="block max-h-44 overflow-auto whitespace-pre-wrap break-words rounded bg-surface px-2 py-1.5 font-mono text-xs text-muted data-[ui-side=after]:font-bold data-[ui-side=after]:text-foreground data-[ui-side=before]:font-normal"
			{...readDataUiFn({
				dataUi: "EditorVersionDiffValue",
				state: {
					side,
				},
			})}
		>
			{formatValueFn(value)}
		</code>
	) : (
		<span className="flex min-w-0 flex-wrap gap-2">
			{assetReferenceIds.map((resourceId, index) => (
				<EditorAssetThumbnail
					key={`${index}:${resourceId}`}
					resourceId={resourceId}
					size="lg"
				/>
			))}
		</span>
	);
};

const VersionBump = ({ bump }: { readonly bump?: ProjectCompatibilityDiffResult }) =>
	bump === undefined ? null : (
		<span
			className="shrink-0 rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider data-[ui-bump=major]:border-danger/40 data-[ui-bump=major]:bg-danger/10 data-[ui-bump=major]:text-danger data-[ui-bump=minor]:border-success data-[ui-bump=minor]:bg-success data-[ui-bump=minor]:font-bold data-[ui-bump=minor]:text-success-contrast"
			{...readDataUiFn({
				dataUi: "EditorVersionBump",
				state: {
					bump,
				},
			})}
		>
			{bump}
		</span>
	);

const ChangeKind = ({ change }: { readonly change: ProjectVersionItemDiff["change"] }) =>
	change === "changed" ? null : (
		<span
			className="shrink-0 text-xs font-semibold capitalize text-accent data-[ui-change=added]:text-success data-[ui-change=deleted]:text-danger"
			{...readDataUiFn({
				dataUi: "EditorVersionChangeKind",
				state: {
					change,
				},
			})}
		>
			{change}
		</span>
	);

const ItemChangeTitle = ({
	change,
	uid,
}: {
	readonly change: ProjectVersionItemDiff["change"];
	readonly uid: string;
}) => {
	const item = useItemByUid(uid);
	return (
		<div
			className="flex min-w-0 items-center gap-3"
			{...readDataUiFn({
				dataUi: "EditorVersionItemReference",
				state: {
					available: item !== undefined,
				},
			})}
		>
			{item === undefined ? (
				<span className="min-w-0">
					<span className="block text-sm font-semibold">Item</span>
					<span className="mt-0.5 block break-all font-mono text-xs font-normal text-muted">
						{uid}
					</span>
				</span>
			) : (
				<DetailReference itemId={item.id} />
			)}
			<ChangeKind change={change} />
		</div>
	);
};

const ValueChange = ({
	change,
	title,
}: {
	readonly change: ProjectVersionValueChange;
	readonly title: ReactNode;
}) => (
	<article
		className="ak-list-row grid gap-3 rounded-xl px-4 py-3"
		data-ui="EditorVersionChangeRow"
	>
		<div className="flex items-start justify-between gap-3">
			<div className="min-w-0 flex-1">
				<div className="min-w-0 text-sm font-semibold">{title}</div>
				<div className="mt-2 min-w-0 break-all text-xs font-semibold text-accent">
					{change.path || "Entire item"}
				</div>
			</div>
			<VersionBump bump={change.bump} />
		</div>
		<div className="grid gap-3 border-t border-line/60 pt-3 lg:grid-cols-2">
			<div className="min-w-0">
				<div className="mb-1 text-[0.65rem] font-semibold uppercase tracking-wider text-subtle">
					Before
				</div>
				<DiffValue
					path={change.path}
					side="before"
					value={change.before}
				/>
			</div>
			<div className="min-w-0">
				<div className="mb-1 text-[0.65rem] font-semibold uppercase tracking-wider text-subtle">
					After
				</div>
				<DiffValue
					path={change.path}
					side="after"
					value={change.after}
				/>
			</div>
		</div>
	</article>
);

const BinaryChange = ({
	change,
	title,
}: {
	readonly change: ProjectVersionBinaryDiff;
	readonly title: string;
}) => (
	<article
		className="ak-list-row grid gap-2 rounded-xl px-4 py-3"
		data-ui="EditorVersionChangeRow"
	>
		<div className="flex items-start justify-between gap-3">
			<div className="min-w-0">
				<h3 className="text-sm font-semibold">{title}</h3>
				<div className="mt-1 flex min-w-0 items-center gap-2">
					<ChangeKind change={change.change} />
					<span className="min-w-0 break-all font-mono text-xs text-muted">
						{change.id}
					</span>
				</div>
			</div>
			<VersionBump bump={change.bump} />
		</div>
	</article>
);

export const VersionDiff = ({ diff }: { readonly diff: ProjectVersionDiff }) =>
	diff.hasChanges ? (
		<div
			className="ak-list grid gap-2"
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
							<ItemChangeTitle
								change={item.change}
								uid={item.uid}
							/>
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
