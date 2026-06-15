import type { ItemId } from "~/manifest/manifestId";

export namespace activationInputStorageKey {
	export interface Props {
		ownerItemInstanceId: string;
		itemId: ItemId;
	}
}

export const activationInputStorageKey = ({
	ownerItemInstanceId,
	itemId,
}: activationInputStorageKey.Props) => `${ownerItemInstanceId}:activation-input:${itemId}`;
