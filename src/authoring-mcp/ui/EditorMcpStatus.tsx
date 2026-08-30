import { readDataUiFn } from "~/ui/fn/readDataUiFn";

export type EditorMcpStatusTone = "danger" | "muted" | "success";

export const EditorMcpStatus = ({
	message,
	tone = "muted",
}: {
	readonly message: string;
	readonly tone?: EditorMcpStatusTone;
}) => (
	<p
		className="text-sm data-[ui-tone=danger]:text-danger data-[ui-tone=muted]:text-muted data-[ui-tone=success]:text-success"
		{...readDataUiFn({
			dataUi: "EditorMcpStatus",
			state: {
				tone,
			},
		})}
	>
		{message}
	</p>
);
