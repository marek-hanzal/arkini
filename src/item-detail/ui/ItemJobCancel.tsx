import { X } from "lucide-react";

import { useItemJobCancelController } from "~/item-detail/ui/useItemJobCancelController";
import { useTranslator } from "~/translation/ui/useTranslator";
import { LinkButton } from "~/ui/ui/LinkButton";
import { Tooltip } from "~/ui/ui/Tooltip";

/** The same exact-job cancellation control beside production status in Lines and Queue. */
export const ItemJobCancel = (props: useItemJobCancelController.Props) => {
	const cancel = useItemJobCancelController(props);
	const translator = useTranslator();
	return (
		<Tooltip
			content={translator.textFn("Stop this job. Materials already used won't be returned.")}
		>
			<LinkButton
				className="inline-flex shrink-0 items-center gap-2 text-sm"
				disabled={cancel.disabled}
				onClick={cancel.cancelFn}
			>
				<X className="size-4" />
				{translator.textFn("Cancel")}
			</LinkButton>
		</Tooltip>
	);
};
