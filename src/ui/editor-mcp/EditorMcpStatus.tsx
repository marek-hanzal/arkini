const statusClassNames = {
	muted: "text-sm text-muted",
	danger: "text-sm text-danger",
	success: "text-sm text-success",
} as const;

export type EditorMcpStatusTone = keyof typeof statusClassNames;

export const editorMcpInputClassName =
	"w-full rounded-lg border border-line bg-surface px-3 py-2 text-foreground outline-none disabled:cursor-not-allowed disabled:opacity-60";

export const EditorMcpStatus = ({
	message,
	tone = "muted",
}: {
	readonly message: string;
	readonly tone?: EditorMcpStatusTone;
}) => <p className={statusClassNames[tone]}>{message}</p>;

export const EditorMcpCopyableUrl = ({
	copied,
	label,
	onCopy,
	url,
}: {
	readonly copied: boolean;
	readonly label: string;
	readonly onCopy: () => void;
	readonly url: string;
}) => (
	<div className="flex min-w-0 items-center gap-1 text-sm text-success">
		<span className="min-w-0 break-all">
			{label}: {url}
		</span>
		<button
			type="button"
			className="grid size-6 shrink-0 cursor-pointer place-items-center border-0 bg-transparent p-0 text-current opacity-65 transition-opacity hover:opacity-100"
			title={copied ? "Copied" : "Copy URL"}
			onClick={onCopy}
		>
			<span className={`${copied ? "icon-[lucide--check]" : "icon-[lucide--copy]"} size-4`} />
		</button>
	</div>
);
