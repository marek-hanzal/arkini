const statusClassNames = {
	muted: "text-sm text-muted",
	danger: "text-sm text-danger",
	success: "text-sm text-success",
} as const;

export type EditorMcpStatusTone = keyof typeof statusClassNames;

export const EditorMcpStatus = ({
	message,
	tone = "muted",
}: {
	readonly message: string;
	readonly tone?: EditorMcpStatusTone;
}) => <p className={statusClassNames[tone]}>{message}</p>;
