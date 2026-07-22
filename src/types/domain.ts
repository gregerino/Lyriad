export type FadeSettings = {
  fadeInMs: number;
  fadeOutMs: number;
};

export type MusicSlot = {
  sceneId: string;
  slotIndex: number; // 1-10
  audioFileId: string | null;
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

export type AudioFile = {
  id: string;
  filename: string;
  sizeBytes: number;
  r2Key: string;
  mimeType: string;
  category: string | null;
  tags: string[];
  createdAt: string;
};

export type AudioFileWithPlaybackUrl = AudioFile & { playbackUrl: string };

export type Scene = {
  id: string;
  name: string;
  description: string | null;
  musicSlots: MusicSlot[];
  oneShotSlots: OneShotSlot[];
  createdAt: string;
  updatedAt: string;
};
