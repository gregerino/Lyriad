export type TrackState = {
  id: string;
  name: string;
  duration: number;
  isPlaying: boolean;
  loop: boolean;
  volume: number;
};

type Track = {
  name: string;
  buffer: AudioBuffer;
  gainNode: GainNode;
  source: AudioBufferSourceNode | null;
  loop: boolean;
  volume: number;
  /** Playback offset (seconds) to resume from on next play(). */
  offset: number;
  /** ctx.currentTime at which the current source started, adjusted for offset. */
  startedAt: number;
};

type Listener = (tracks: Record<string, TrackState>) => void;

/**
 * Framework-agnostic Web Audio playback engine. Owns the AudioContext, one
 * GainNode per track for independent volume control, and playback state.
 * UI/React state is derived via subscribe() — this class holds no React state.
 */
export class AudioEngine {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private tracks = new Map<string, Track>();
  private listeners = new Set<Listener>();

  private ensureContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
      this.masterGain = this.audioContext.createGain();
      this.masterGain.connect(this.audioContext.destination);
    }
    if (this.audioContext.state === "suspended") {
      void this.audioContext.resume();
    }
    return this.audioContext;
  }

  private getTrack(id: string): Track {
    const track = this.tracks.get(id);
    if (!track) throw new Error(`Unknown track: ${id}`);
    return track;
  }

  private notify(): void {
    const snapshot = this.getState();
    for (const listener of this.listeners) listener(snapshot);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  getState(): Record<string, TrackState> {
    const state: Record<string, TrackState> = {};
    for (const [id, track] of this.tracks) {
      state[id] = {
        id,
        name: track.name,
        duration: track.buffer.duration,
        isPlaying: track.source !== null,
        loop: track.loop,
        volume: track.volume,
      };
    }
    return state;
  }

  async loadTrack(id: string, name: string, data: ArrayBuffer): Promise<void> {
    const ctx = this.ensureContext();
    const buffer = await ctx.decodeAudioData(data);
    const gainNode = ctx.createGain();
    gainNode.connect(this.masterGain!);
    this.tracks.set(id, {
      name,
      buffer,
      gainNode,
      source: null,
      loop: false,
      volume: 1,
      offset: 0,
      startedAt: 0,
    });
    this.notify();
  }

  play(id: string): void {
    const track = this.getTrack(id);
    if (track.source) return;
    const ctx = this.ensureContext();
    const source = ctx.createBufferSource();
    source.buffer = track.buffer;
    source.loop = track.loop;
    source.connect(track.gainNode);
    source.onended = () => {
      if (track.source === source) {
        track.source = null;
        track.offset = 0;
        this.notify();
      }
    };
    const offset = track.offset % track.buffer.duration;
    source.start(0, offset);
    track.source = source;
    track.startedAt = ctx.currentTime - offset;
    this.notify();
  }

  pause(id: string): void {
    const track = this.getTrack(id);
    if (!track.source) return;
    const ctx = this.ensureContext();
    track.offset = (ctx.currentTime - track.startedAt) % track.buffer.duration;
    track.source.onended = null;
    track.source.stop();
    track.source = null;
    this.notify();
  }

  stop(id: string): void {
    const track = this.getTrack(id);
    if (track.source) {
      track.source.onended = null;
      track.source.stop();
      track.source = null;
    }
    track.offset = 0;
    this.notify();
  }

  setVolume(id: string, volume: number): void {
    const track = this.getTrack(id);
    const clamped = Math.min(1, Math.max(0, volume));
    track.volume = clamped;
    track.gainNode.gain.setValueAtTime(clamped, this.ensureContext().currentTime);
    this.notify();
  }

  setLoop(id: string, loop: boolean): void {
    const track = this.getTrack(id);
    track.loop = loop;
    if (track.source) track.source.loop = loop;
    this.notify();
  }

  removeTrack(id: string): void {
    const track = this.tracks.get(id);
    if (!track) return;
    if (track.source) {
      track.source.onended = null;
      track.source.stop();
    }
    track.gainNode.disconnect();
    this.tracks.delete(id);
    this.notify();
  }

  dispose(): void {
    for (const id of [...this.tracks.keys()]) this.removeTrack(id);
    this.listeners.clear();
    void this.audioContext?.close();
    this.audioContext = null;
    this.masterGain = null;
  }
}
