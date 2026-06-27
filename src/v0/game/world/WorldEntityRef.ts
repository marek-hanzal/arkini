export type WorldEntityRef =
	| {
			kind: "activeEffect";
			id: string;
	  }
	| {
			kind: "boardItem";
			id: string;
	  }
	| {
			kind: "craftJob";
			id: string;
	  }
	| {
			kind: "inventorySlot";
			index: number;
	  }
	| {
			kind: "itemSpawnJob";
			id: string;
	  }
	| {
			kind: "producerJob";
			id: string;
	  }
	| {
			kind: "producerQueue";
			producerItemInstanceId: string;
	  };
