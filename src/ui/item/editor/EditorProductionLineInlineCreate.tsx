import type { EditorLineCollectionItem } from "~/bridge/item/editor/appendEditorItemLineFx";
import { EditorInlineAddStatus } from "~/ui/form/EditorInlineAddStatus";
import { ItemLineOutputs } from "~/ui/item-detail/ItemLineOutputs";
import { EditorProductionLineInlineFields } from "~/ui/item/editor/EditorProductionLineInlineFields";
import { useEditorProductionLineInlineCreate } from "~/ui/item/editor/useEditorProductionLineInlineCreate";

export const EditorProductionLineInlineCreate = ({
	item,
}: {
	readonly item: EditorLineCollectionItem;
}) => {
	const { discard, draft, errors, mutationError, pending, save, start, updateDraft } =
		useEditorProductionLineInlineCreate(item);
	if (draft === undefined) {
		return (
			<EditorInlineAddStatus
				action={
					<button
						type="button"
						className="cursor-pointer text-sm font-semibold text-accent hover:text-accent-hover"
						onClick={start}
					>
						Add line
					</button>
				}
				description="Add another production path directly in this item detail."
				title="Production lines"
			/>
		);
	}
	return (
		<article
			className="ak-list-row overflow-hidden rounded-xl border-b border-l-2 border-line border-l-accent px-3 py-5 pl-4 first:pt-3 last:border-b-0 last:pb-5"
			data-ui="EditorProductionLineInlineCreate"
		>
			<div className="flex justify-end gap-4 text-sm font-semibold">
				<button
					type="button"
					className="cursor-pointer text-muted hover:text-foreground"
					disabled={pending}
					onClick={discard}
				>
					Discard
				</button>
				<button
					type="button"
					className="cursor-pointer text-accent hover:text-accent-hover disabled:opacity-60"
					disabled={pending}
					onClick={() => void save()}
				>
					{pending ? "Saving…" : "Save"}
				</button>
			</div>
			<div className="mt-2">
				<EditorProductionLineInlineFields
					draft={draft}
					errors={errors}
					updateDraft={updateDraft}
				/>
			</div>
			<div className="mt-4 grid min-w-0 grid-cols-[minmax(0,1fr)_2rem_minmax(0,1fr)] gap-x-4">
				<section className="min-w-0">
					<h4 className="border-b border-line pb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted">
						Inputs
					</h4>
					<p className="py-3 text-sm text-muted">No material input required.</p>
				</section>
				<div className="grid place-items-center text-muted">
					<span className="icon-[lucide--chevron-right] size-5" />
				</div>
				<ItemLineOutputs
					disabled={false}
					output={[]}
				/>
			</div>
			{mutationError === undefined ? null : (
				<p className="mt-3 text-sm text-danger">
					{mutationError instanceof Error ? mutationError.message : String(mutationError)}
				</p>
			)}
		</article>
	);
};
