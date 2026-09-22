import { Overlay } from "~/ui/ui/Overlay";
import { Trash2, X } from "lucide-react";

import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { forceDeleteFx } from "~/item-authoring/fx/forceDeleteFx";
import type { Project } from "~/project-authoring/type/Project";
import { Button } from "~/ui/ui/Button";
import { LinkButton } from "~/ui/ui/LinkButton";
import { useTranslator } from "~/translation/ui/useTranslator";
import { Mx } from "~/translation/ui/Mx";

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
} as const;

const ForceDeleteImpactList = ({
	impact,
	project,
}: {
	readonly impact: forceDeleteFx.Impact;
	readonly project: Project;
}) => {
	const translator = useTranslator();
	const entries: string[] = [];
	for (const [surface, count] of Object.entries(impact.removedStartEntries)) {
		if (count > 0)
			entries.push(
				`${translator.textFn("Remove")} ${count} ${translator.textFn("starting")} ${translator.textFn(startSurfaceTitles[surface as keyof typeof startSurfaceTitles])} ${translator.textFn(count === 1 ? "entry" : "entries")}`,
			);
	}
	for (const { ownerItemId, ruleNumber } of impact.removedMergeRules)
		entries.push(
			`${translator.textFn("Remove merge rule")} ${ruleNumber} ${translator.textFn("from")} ${readItemTitleFn(project, ownerItemId)}`,
		);
	for (const { ownerItemId, inputNumber } of impact.removedActionInputs)
		entries.push(
			`${translator.textFn("Remove action input")} ${inputNumber} ${translator.textFn("from")} ${readItemTitleFn(project, ownerItemId)}`,
		);
	for (const { ownerItemId, ruleNumber } of impact.removedActionRules)
		entries.push(
			`${translator.textFn("Remove action rule")} ${ruleNumber} ${translator.textFn("from")} ${readItemTitleFn(project, ownerItemId)}`,
		);
	for (const { ownerItemId, title } of impact.removedLines)
		entries.push(
			`${translator.textFn("Remove production line")} “${title}” ${translator.textFn("from")} ${readItemTitleFn(project, ownerItemId)}`,
		);
	for (const ownerItemId of impact.removedUnitOutputOwnerIds)
		entries.push(
			`${translator.textFn("Remove the unit depletion output from")} ${readItemTitleFn(project, ownerItemId)}`,
		);
	for (const ownerItemId of impact.removedExpiryOutputOwnerIds)
		entries.push(
			`${translator.textFn("Remove the expiry output from")} ${readItemTitleFn(project, ownerItemId)}`,
		);

	return (
		<div className="mt-4 rounded-xl border border-line bg-surface/70 p-4">
			<p className="text-sm font-semibold">{translator.textFn("This will also:")}</p>
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
}) => {
	const translator = useTranslator();
	return (
		<Overlay
			onCloseFn={() => {
				if (!pending) onCancelFn();
			}}
		>
			<div
				className="w-full max-w-2xl rounded-2xl border border-line-strong bg-modal p-6 text-foreground shadow-2xl"
				data-ui="EditorItemDeleteDialog"
			>
				<h2 className="text-lg font-semibold">
					{translator.textFn(force ? "Force delete item?" : "Delete item?")}
				</h2>
				<p className="mt-2 text-sm leading-6 text-muted">
					{translator.textFn("Delete")}{" "}
					<strong className="text-foreground">{item.title || item.id}</strong>{" "}
					{translator.textFn("from the game.")}
				</p>
				{force ? <Mx label="Force delete reference removal help" /> : null}
				{force ? (
					<ForceDeleteImpactList
						impact={impact}
						project={project}
					/>
				) : null}
				<div className="mt-2 text-sm text-muted">
					<Mx label="Deleted item artwork help" />
				</div>
				<div className="mt-3 grid gap-2 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm leading-6 text-danger">
					<Mx label="Delete item irreversible warning" />
					{force ? <Mx label="Force delete item integrity warning" /> : null}
				</div>
				<DeleteError error={error} />
				<div className="mt-6 flex items-center justify-between gap-4">
					<LinkButton
						className="inline-flex items-center gap-1.5"
						disabled={pending}
						onClick={onCancelFn}
					>
						<X className="size-4" />
						{translator.textFn("Cancel")}
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
							{translator.textFn(force ? "Force delete" : "Delete")}
						</Button>
					</div>
				</div>
			</div>
		</Overlay>
	);
};
