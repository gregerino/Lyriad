export type MusicSlot = {
  sceneId: string;
  slotIndex: number; // 1-10
  audioFileId: string | null;
  name: string | null;
  volume: number; // 0-1
  loop: boolean;
};

export type OneShotSlot = {
  setId: string;
  slotIndex: number; // 1-20
  audioFileId: string | null;
  name: string | null;
  volume: number; // 0-1
  /** A looping pad plays until it is pressed again rather than firing once. */
  loop: boolean;
  color: string | null;
  icon: string | null;
};

/**
 * One bank of one-shot pads, belonging to no particular scene — any scene can
 * show any set, the way any scene can be picked from the tab bar.
 */
export type OneShotSet = {
  id: string;
  name: string;
  /** Free-form group the set is filed under; null means "Utan grupp". */
  groupName: string | null;
  position: number;
  slots: OneShotSlot[];
};

export type AudioCategory = "music" | "oneshot";

export type AudioFile = {
  id: string;
  filename: string;
  sizeBytes: number;
  r2Key: string;
  mimeType: string;
  category: AudioCategory | null;
  createdAt: string;
};

export type AudioFileWithPlaybackUrl = AudioFile & { playbackUrl: string };

export type AudioFileWithMeta = AudioFileWithPlaybackUrl & { collectionIds: string[] };

export type Collection = {
  id: string;
  name: string;
  /** Free-form theme the collection is filed under; null means uncategorised. */
  category: string | null;
  createdAt: string;
};

export type MixPreset = {
  id: string;
  sceneId: string;
  name: string;
  masterVolume: number;
  groupVolumes: Record<string, number>;
  slotVolumes: Record<string, number>;
  createdAt: string;
};

/** A campaign the scenes are grouped under — "Curse of Strahd", "Phandelver". */
export type Campaign = {
  id: string;
  name: string;
  position: number;
  createdAt: string;
};

export type Scene = {
  id: string;
  name: string;
  description: string | null;
  favorite: boolean;
  /** Null means the scene belongs to no campaign. */
  campaignId: string | null;
  musicSlots: MusicSlot[];
  createdAt: string;
  updatedAt: string;
};
