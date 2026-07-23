export type FadeSettings = {
  fadeInMs: number;
  fadeOutMs: number;
};

export type MusicSlot = {
  sceneId: string;
  slotIndex: number; // 1-10
  audioFileId: string | null;
  name: string | null;
  volume: number; // 0-1
  loop: boolean;
  fade: FadeSettings;
};

export type OneShotSlot = {
  sceneId: string;
  slotIndex: number; // 1-20
  audioFileId: string | null;
  volume: number; // 0-1
  color: string | null;
  icon: string | null;
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

export type Scene = {
  id: string;
  name: string;
  description: string | null;
  favorite: boolean;
  musicSlots: MusicSlot[];
  oneShotSlots: OneShotSlot[];
  createdAt: string;
  updatedAt: string;
};
