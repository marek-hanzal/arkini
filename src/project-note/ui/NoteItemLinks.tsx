import { useCallback } from "react";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { Link } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";

import { EditorItemReferenceControl } from "~/authoring-form/ui/EditorItemAutocompleteField";
import { EditorItemThumbnail } from "~/authoring-form/ui/EditorItemThumbnail";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { Button } from "~/ui/ui/Button";
import { Tooltip } from "~/ui/ui/Tooltip";

interface NoteItemLinksProps {
	readonly itemUids: ReadonlyArray<string>;
	readonly requiredItemUid?: string;
	readonly disabled: boolean;
	readonly onChangeFn?: (itemUids: ReadonlyArray<string>) => void;
	readonly onUnlinkFn?: (itemUid: string) => void;
}

/** Resolves stable note relationships through the current project item presentation. */
export const NoteItemLinks = ({
	itemUids,
	requiredItemUid,
	disabled,
	onChangeFn,
	onUnlinkFn,
}: NoteItemLinksProps) => {
	const project = useEditorProject();
	const items = Object.values(project.config.items);
	const includeItemFn = useCallback(
		(item: ItemSchema.Type) => !itemUids.includes(item.uid),
		[
			itemUids,
		],
	);
	if (itemUids.length === 0 && onChangeFn === undefined) return null;
	return (
		<div
			className="grid gap-3"
			data-ui="EditorNoteItemLinks"
		>
			<div className="flex flex-wrap gap-2">
				{itemUids.map((itemUid) => {
					const item = items.find((candidate) => candidate.uid === itemUid);
					return (
						<div
							className="flex min-w-0 items-center gap-1 rounded-xl border border-line bg-canvas/50 p-1"
							key={itemUid}
						>
							{item === undefined ? (
								<span
									className="px-2 text-sm text-muted"
									data-ui="EditorNoteMissingItem"
								>
									Unavailable item · {itemUid}
								</span>
							) : (
								<Link
									className="flex min-w-0 items-center gap-2 pr-2 text-sm hover:text-accent"
									data-ui="EditorNoteItemLink"
									to="/editor/$projectId/editor/items/$itemUid/detail/$sectionId"
									params={{
										projectId: project.projectId,
										itemUid: item.uid,
										sectionId: "notes",
									}}
								>
									<EditorItemThumbnail
										resourceIds={item.asset.default}
										size="sm"
									/>
									<span className="truncate">{item.title || item.id}</span>
								</Link>
							)}
							<Tooltip
								content={
									requiredItemUid === itemUid
										? "New notes stay linked to this item"
										: "Unlink item from note"
								}
								placement="top"
							>
								<Button
									className="size-8 min-h-0 shrink-0 border-0 bg-transparent p-0 text-muted shadow-none hover:text-danger"
									data-ui="EditorNoteUnlinkItem"
									disabled={disabled || requiredItemUid === itemUid}
									onClick={() => {
										if (disabled || requiredItemUid === itemUid) return;
										if (onChangeFn !== undefined)
											onChangeFn(itemUids.filter((uid) => uid !== itemUid));
										else onUnlinkFn?.(itemUid);
									}}
								>
									<Trash2 className="size-4" />
								</Button>
							</Tooltip>
						</div>
					);
				})}
			</div>
			{onChangeFn === undefined ? null : (
				<fieldset disabled={disabled}>
					{/* An attachment settles this single-value picker; begin a fresh search next. */}
					<EditorItemReferenceControl
						key={itemUids.length}
						label="Link item"
						value=""
						includeItemFn={includeItemFn}
						onChangeFn={(itemId) => {
							const item = project.config.items[itemId];
							if (disabled || item === undefined || itemUids.includes(item.uid))
								return;
							onChangeFn([
								...itemUids,
								item.uid,
							]);
						}}
					/>
				</fieldset>
			)}
		</div>
	);
};
