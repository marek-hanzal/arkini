import { GitBranch } from "lucide-react";
import { EditorItemSearchThumbnail } from "~/authoring-form/ui/EditorItemThumbnail";
import { useEditorItemSearchOptions } from "~/authoring-form/ui/useEditorItemSearchOptions";
import { EditorSectionPage } from "~/authoring-shell/ui/EditorSectionPage";
import { EditorPageHelp } from "~/authoring-shell/ui/EditorPageHelp";
import { EditorSearchCombobox } from "~/editor-control/ui/EditorSearchCombobox";
import { ItemChain } from "~/item-chain/ui/ItemChain";
import { Mx } from "~/translation/ui/Mx";
import { useTranslator } from "~/translation/ui/useTranslator";
import { Status } from "~/ui/ui/Status";

/** Global entry to the same root-owned exploration available on Item detail. */
export const EditorChains = ({
	itemId,
	onItemChangeFn,
}: {
	readonly itemId: string;
	readonly onItemChangeFn: (id: string) => void;
}) => {
	const { items, options } = useEditorItemSearchOptions();
	const translator = useTranslator();
	return (
		<EditorSectionPage
			header={
				<header
					className="flex items-center gap-4"
					data-ui="EditorChainsHeader"
				>
					<h1 className="text-xl font-semibold">{translator.textFn("Chains")}</h1>
					<div className="min-w-0 flex-1">
						<EditorSearchCombobox
							displaySelectedLabel
							label={translator.textFn("Item")}
							labelVisible={false}
							placeholder={translator.textFn("Choose a starting item")}
							emptyLabel={translator.textFn("No matches.")}
							value={itemId}
							options={options}
							onChangeFn={onItemChangeFn}
							renderPreviewFn={(option) => (
								<EditorItemSearchThumbnail item={items[option.id]} />
							)}
							renderSelectedPreviewFn={(option) => (
								<EditorItemSearchThumbnail
									item={option === undefined ? undefined : items[option.id]}
									selected
								/>
							)}
						/>
					</div>
					<EditorPageHelp
						title={translator.textFn("Chain")}
						content={<Mx label="Chain help" />}
					/>
				</header>
			}
		>
			{items[itemId] === undefined ? (
				<Status
					icon={GitBranch}
					title={translator.textFn("Choose a starting item")}
					description={translator.textFn("Chain introduction")}
					size="large"
					variant="flat"
				/>
			) : (
				<ItemChain itemId={itemId} />
			)}
		</EditorSectionPage>
	);
};
