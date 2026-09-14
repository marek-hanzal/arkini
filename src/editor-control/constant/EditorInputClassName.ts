export const editorDisabledInputClassName =
	"disabled:cursor-not-allowed disabled:border-line disabled:bg-surface-raised/60 disabled:text-muted disabled:placeholder:text-subtle disabled:data-[ui-invalid=true]:border-danger";

export const editorInputClassName = `min-h-[var(--ak-control-min-height)] w-full rounded-lg border border-control-border bg-[var(--ak-editor-background)] px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-subtle data-[ui-invalid=true]:border-danger ${editorDisabledInputClassName}`;
