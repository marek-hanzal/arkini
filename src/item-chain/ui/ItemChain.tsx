import { useMemo, useState } from "react";
import { readItemChainQueryFn } from "~/graph/fn/readItemChainQueryFn";
import { useEditorGraphQuery } from "~/graph/ui/useEditorGraphQuery";
import { GraphQueryResult } from "~/graph/ui/GraphQueryResult";
import { EditorSelect } from "~/editor-control/ui/EditorSelect";
import { useTranslator } from "~/translation/ui/useTranslator";

/** Consequence traversal shares its exact kinds and depth meaning with the MCP Chain query. */
export const ItemChain = ({ itemUid }: { readonly itemUid: string }) => {
	const translator = useTranslator();
	const [depth, setDepthFn] = useState("5");
	const query = useMemo(
		() => readItemChainQueryFn(itemUid, Number(depth)),
		[
			itemUid,
			depth,
		],
	);
	const state = useEditorGraphQuery(query);
	return (
		<section
			data-ui="EditorItemChain"
			className="flex flex-col gap-3"
		>
			<div className="flex justify-end">
				<EditorSelect
					label={translator.textFn("Depth")}
					size="control"
					value={depth}
					onChangeFn={setDepthFn}
					options={Array.from(
						{
							length: 12,
						},
						(_, index) => ({
							value: String(index + 1),
							label: `${translator.textFn("Depth")} ${index + 1}`,
						}),
					)}
				/>
			</div>
			<GraphQueryResult
				state={state}
				showPaths
			/>
		</section>
	);
};
