const statusClassNames = {
	muted: "text-sm text-muted",
	danger: "text-sm text-danger",
	success: "text-sm text-success",
} as const;

export type EditorMcpStatusTone = keyof typeof statusClassNames;

export const editorMcpInputClassName =
	"w-full rounded-lg border border-line bg-surface px-3 py-2 text-foreground outline-none disabled:cursor-progress disabled:opacity-60";

export const EditorMcpStatus = ({
	message,
	tone = "muted",
}: {
	readonly message: string;
	readonly tone?: EditorMcpStatusTone;
}) => <p className={statusClassNames[tone]}>{message}</p>;
