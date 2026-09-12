import { Check, Copy } from "lucide-react";

import { useCopyButtonController } from "./useCopyButtonController";

interface CopyButtonProps extends useCopyButtonController.Props {
	readonly title?: string;
}

export const CopyButton = ({ value, title = "Copy" }: CopyButtonProps) => {
	const { copied, copyFn, error } = useCopyButtonController({
		value,
	});
	const Icon = copied ? Check : Copy;
	return (
		<>
			<button
				data-ui="CopyButton"
				type="button"
				className="grid size-6 shrink-0 cursor-pointer place-items-center border-0 bg-transparent p-0 text-current opacity-65 transition-opacity hover:opacity-100"
				title={copied ? "Copied" : title}
				onClick={() => void copyFn()}
			>
				<Icon className="size-4" />
			</button>
			{error === undefined ? null : <span className="text-sm text-danger">{error}</span>}
		</>
	);
};
