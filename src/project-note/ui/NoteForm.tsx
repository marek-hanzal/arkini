import { useRef } from "react";
import { Save, Undo2 } from "lucide-react";

import type { ArtworkCatalogFilterSchema } from "~/artwork-authoring/schema/ArtworkCatalogFilterSchema";
import { EditorTextarea } from "~/editor-control/ui/EditorTextarea";
import { useEditorSaveShortcut } from "~/editor-control/ui/useEditorSaveShortcut";
import { NoteContentMaxLength } from "~/project-note/schema/NoteSchema";
import { NoteLinkPickers } from "~/project-note/ui/NoteLinkPickers";
import { NoteItemLinks } from "~/project-note/ui/NoteItemLinks";
import { NoteResourceLinks } from "~/project-note/ui/NoteResourceLinks";
import { PrimaryButton } from "~/ui/ui/Button";
import { LinkButton } from "~/ui/ui/LinkButton";
import { useTranslator } from "~/translation/ui/useTranslator";

/** One draft editor for note creation and inline edits; callers own persistence and draft state. */
export const NoteForm = ({
	content,
	itemUids,
	resourceUids,
	requiredItemUid,
	requiredResourceUid,
	artworkFilter,
	artworkQuery,
	pending,
	canSave,
	saveLabel,
	onContentChangeFn,
	onItemUidsChangeFn,
	onResourceUidsChangeFn,
	onSaveFn,
	onCancelFn,
}: {
	readonly content: string;
	readonly itemUids: ReadonlyArray<string>;
	readonly resourceUids: ReadonlyArray<string>;
	readonly requiredItemUid?: string;
	readonly requiredResourceUid?: string;
	readonly artworkFilter?: ArtworkCatalogFilterSchema.Type;
	readonly artworkQuery?: string;
	readonly pending: boolean;
	readonly canSave: boolean;
	readonly saveLabel: "Create note" | "Save";
	readonly onContentChangeFn: (content: string) => void;
	readonly onItemUidsChangeFn: (itemUids: ReadonlyArray<string>) => void;
	readonly onResourceUidsChangeFn: (resourceUids: ReadonlyArray<string>) => void;
	readonly onSaveFn: () => void;
	readonly onCancelFn?: () => void;
}) => {
	const translator = useTranslator();
	const formRef = useRef<HTMLElement>(null);
	useEditorSaveShortcut({
		target: formRef,
		saveEnabled: canSave,
		saveFn: onSaveFn,
	});
	return (
		<section
			ref={formRef}
			className="grid min-w-0 gap-3"
			data-ui="EditorNoteForm"
		>
			<EditorTextarea
				maxLength={NoteContentMaxLength}
				maxRows={12}
				minRows={6}
				placeholder={translator.textFn("Write a note…")}
				disabled={pending}
				value={content}
				onChange={(event) => onContentChangeFn(event.currentTarget.value)}
			/>
			<NoteLinkPickers
				itemUids={itemUids}
				resourceUids={resourceUids}
				disabled={pending}
				onItemUidsChangeFn={onItemUidsChangeFn}
				onResourceUidsChangeFn={onResourceUidsChangeFn}
			/>
			<NoteItemLinks
				itemUids={itemUids}
				requiredItemUid={requiredItemUid}
				disabled={pending}
				onChangeFn={onItemUidsChangeFn}
			/>
			<NoteResourceLinks
				resourceUids={resourceUids}
				requiredResourceUid={requiredResourceUid}
				disabled={pending}
				onChangeFn={onResourceUidsChangeFn}
				filter={artworkFilter}
				query={artworkQuery}
			/>
			<div className="flex flex-wrap items-center justify-end gap-2">
				{onCancelFn === undefined ? null : (
					<LinkButton
						className="inline-flex items-center gap-1.5"
						disabled={pending}
						onClick={onCancelFn}
					>
						<Undo2 className="size-4" />
						{translator.textFn("Cancel edit")}
					</LinkButton>
				)}
				<PrimaryButton
					className="gap-2"
					disabled={!canSave}
					cursorIntent={pending ? "progress" : undefined}
					onClick={onSaveFn}
				>
					<Save className="size-4" />
					{saveLabel === "Create note"
						? translator.textFn("Create note")
						: translator.textFn("Save")}
				</PrimaryButton>
			</div>
		</section>
	);
};
