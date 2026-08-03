import type {
	InlineLineDraft,
	InlineLineDraftErrors,
	InlineLineDraftField,
} from "~/ui/item/editor/EditorProductionLineInlineDraft";

const inlineInputClassName =
	"w-full min-w-0 border-0 bg-transparent p-0 text-foreground outline-none placeholder:text-subtle";

const InlineFieldError = ({ children }: { readonly children?: string }) =>
	children === undefined ? null : <p className="mt-1 text-xs text-danger">{children}</p>;

export const EditorProductionLineInlineFields = ({
	draft,
	errors,
	updateDraft,
}: {
	readonly draft: InlineLineDraft;
	readonly errors: InlineLineDraftErrors;
	readonly updateDraft: (field: InlineLineDraftField, value: string) => void;
}) => (
	<div className="flex flex-wrap items-start justify-between gap-4">
		<div className="min-w-0 flex-1">
			<input
				type="text"
				value={draft.title}
				className={`${inlineInputClassName} text-lg font-semibold leading-tight`}
				placeholder="Line title"
				onChange={(event) => updateDraft("title", event.currentTarget.value)}
			/>
			<InlineFieldError>{errors.title}</InlineFieldError>
			<textarea
				value={draft.description}
				className={`${inlineInputClassName} mt-2 resize-none text-sm leading-relaxed text-muted`}
				placeholder="Describe what this line does."
				rows={2}
				onChange={(event) => updateDraft("description", event.currentTarget.value)}
			/>
			<InlineFieldError>{errors.description}</InlineFieldError>
		</div>
		<label className="grid min-w-32 grid-rows-[1rem_1.5rem_1rem] text-right">
			<span className="text-xs font-medium uppercase tracking-[0.08em] text-muted">
				Runtime
			</span>
			<span className="flex items-baseline justify-end gap-1">
				<input
					type="number"
					value={draft.runtimeSeconds}
					className={`${inlineInputClassName} w-20 text-right font-semibold tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
					min={0}
					step={0.1}
					onChange={(event) => updateDraft("runtimeSeconds", event.currentTarget.value)}
				/>
				<span className="font-semibold">s</span>
			</span>
			<span className="self-end text-xs text-muted">Per cycle</span>
			<InlineFieldError>{errors.runtimeSeconds}</InlineFieldError>
		</label>
	</div>
);
