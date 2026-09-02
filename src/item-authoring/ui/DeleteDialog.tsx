import { GitCommitHorizontal, Trash2, X } from "lucide-react";

import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { forceDeleteFx } from "~/item-authoring/fx/forceDeleteFx";
import type { Project } from "~/project-authoring/type/Project";
import { Button, PrimaryButtonLink } from "~/ui/ui/Button";
import { LinkButton } from "~/ui/ui/LinkButton";

const DeleteError = ({ error }: { readonly error: unknown }) =>
	error === undefined ? null : (
		<p className="mt-3 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
			{error instanceof Error ? error.message : String(error)}
		</p>
	);

const readItemTitleFn = (project: Project, itemId: string) =>
	project.config.items[itemId]?.title || itemId;

const startSurfaceTitles = {
	board: "board",
	inventory: "inventory",
	toolbar: "toolbar",
} as const;

const ForceDeleteImpactList = ({
	impact,
	project,
}: {
	readonly impact: forceDeleteFx.Impact;
	readonly project: Project;
}) => {
	const entries: string[] = [];
	for (const [surface, count] of Object.entries(impact.removedStartEntries)) {
		if (count > 0)
			entries.push(
				`Remove ${count} starting ${startSurfaceTitles[surface as keyof typeof startSurfaceTitles]} ${count === 1 ? "entry" : "entries"}`,
			);
	}
	for (const { ownerItemId, ruleNumber } of impact.removedMergeRules)
		entries.push(
			`Remove merge rule ${ruleNumber} from ${readItemTitleFn(project, ownerItemId)}`,
		);
	for (const { ownerItemId, inputNumber } of impact.removedActionInputs)
		entries.push(
			`Remove action input ${inputNumber} from ${readItemTitleFn(project, ownerItemId)}`,
		);
	for (const { ownerItemId, ruleNumber } of impact.removedActionRules)
		entries.push(
			`Remove action rule ${ruleNumber} from ${readItemTitleFn(project, ownerItemId)}`,
		);
	for (const { ownerItemId, title } of impact.removedLines)
		entries.push(
			`Remove production line “${title}” from ${readItemTitleFn(project, ownerItemId)}`,
		);
	for (const ownerItemId of impact.removedChargeOutputOwnerIds)
		entries.push(
			`Remove the charge depletion output from ${readItemTitleFn(project, ownerItemId)}`,
		);
	for (const ownerItemId of impact.removedExpiryOutputOwnerIds)
		entries.push(`Remove the expiry output from ${readItemTitleFn(project, ownerItemId)}`);
	for (const ownerItemId of impact.deletedOwnerItemIds)
		entries.push(
			`Delete ${readItemTitleFn(project, ownerItemId)} because its required production structure is removed`,
		);
	return (
		<div className="mt-4 rounded-xl border border-line bg-surface/70 p-4">
			<p className="text-sm font-semibold">This will also:</p>
			<ul className="mt-2 grid max-h-52 list-disc gap-1.5 overflow-y-auto pl-5 text-sm leading-5 text-muted">
				{entries.map((entry, index) => (
					<li key={`${entry}:${index}`}>{entry}</li>
				))}
			</ul>
		</div>
	);
};

export const DeleteDialog = ({
	error,
	force,
	impact,
	item,
	pending,
	project,
	onCancelFn,
	onConfirmFn,
}: {
	readonly error: unknown;
	readonly force: boolean;
	readonly impact: forceDeleteFx.Impact;
	readonly item: ItemSchema.Type;
	readonly pending: boolean;
	readonly project: Project;
	readonly onCancelFn: () => void;
	readonly onConfirmFn: () => void;
}) => (
	<div className="fixed inset-0 z-[100] grid place-items-center bg-overlay/95 p-[var(--ak-viewport-padding)]">
		<div
			className="w-full max-w-2xl rounded-2xl border border-line-strong bg-surface-raised p-6 text-foreground shadow-2xl"
			data-ui="EditorItemDeleteDialog"
		>
			<h2 className="text-lg font-semibold">
				{force ? "Force delete item?" : "Delete item?"}
			</h2>
			<p className="mt-2 text-sm leading-6 text-muted">
				Delete <strong className="text-foreground">{item.title || item.id}</strong> from the
				game
				{force ? " and remove every authored structure that directly references it." : "."}
			</p>
			{force ? (
				<ForceDeleteImpactList
					impact={impact}
					project={project}
				/>
			) : null}
			<p className="mt-2 text-sm text-muted">
				Its asset files remain available in the project.
			</p>
			<div className="mt-3 grid gap-2 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm leading-6 text-danger">
				<p>
					Deleting an item is a breaking gameplay change. Current Board scenarios and
					existing published game saves remain stored, but they cannot load the new major
					version. Create a Version first to preserve the matching project for
					restoration.
				</p>
				{force ? (
					<p>
						The resulting config will remain structurally valid, but the game can be
						logically broken. No additional references or gameplay relationships will be
						repaired.
					</p>
				) : null}
			</div>
			<p className="mt-2 text-xs text-subtle">Item ID: {item.id}</p>
			<DeleteError error={error} />
			<div className="mt-6 flex items-center justify-between gap-4">
				<LinkButton
					className="inline-flex items-center gap-1.5"
					disabled={pending}
					onClick={onCancelFn}
				>
					<X className="size-4" />
					Cancel
				</LinkButton>
				<div className="flex shrink-0 items-center gap-2">
					<Button
						className="gap-1.5"
						disabled={pending}
						cursorIntent={pending ? "progress" : undefined}
						data-ui="EditorItemDeleteConfirm"
						onClick={onConfirmFn}
					>
						<Trash2 className="size-4" />
						{force ? "Force delete" : "Delete"}
					</Button>
					<PrimaryButtonLink
						className="gap-1.5"
						disabled={pending}
						data-ui="EditorItemDeleteCreateVersion"
						to="/editor/$projectId/versions/commit"
						params={{
							projectId: project.projectId,
						}}
						search={{
							returnTo: `/editor/${encodeURIComponent(project.projectId)}/editor/items/${encodeURIComponent(item.uid)}/detail/delete`,
						}}
					>
						<GitCommitHorizontal className="size-4" />
						Commit
					</PrimaryButtonLink>
				</div>
			</div>
		</div>
	</div>
);
