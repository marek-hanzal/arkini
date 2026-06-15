import type { ItemId } from "~/v0/manifest/manifestId";

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
