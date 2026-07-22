export type FadeCurve = "linear" | "exponential";

export type TrackState = {
  id: string;
  name: string;
  duration: number;
  isPlaying: boolean;
  loop: boolean;
  volume: number;
  /** True while a scheduled fadeIn/fadeOut ramp is in flight. */
  fading: boolean;
};

export type OneShotState = {
  id: string;
  name: string;
  duration: number;
  volume: number;
  /** How many overlapping instances of this slot are currently playing. */
  activeCount: number;
};

export type EngineState = {
  tracks: Record<string, TrackState>;
  oneShots: Record<string, OneShotState>;
  masterVolume: number;
};

type Track = {
  name: string;
  buffer: AudioBuffer;
  gainNode: GainNode;
  source: AudioBufferSourceNode | null;
  loop: boolean;
  /** Target volume (0-1) — what the slider shows, independent of the ramp in progress. */
  volume: number;
  /** Playback offset (seconds) to resume from on next play()/fadeIn(). */
  offset: number;
  /** ctx.currentTime at which the current source started, adjusted for offset. */
  startedAt: number;
  fadeTimer: ReturnType<typeof setTimeout> | null;
};

type OneShotSlot = {
  name: string;
  buffer: AudioBuffer;
  /** Shared by every overlapping instance of this slot, so slot volume affects all of them at once. */
  gainNode: GainNode;
  volume: number;
  activeSources: Set<AudioBufferSourceNode>;
};

type Listener = (state: EngineState) => void;

/** exponentialRampToValueAtTime rejects a target/start of exactly 0. */
const MIN_GAIN = 0.0001;

/**
 * Framework-agnostic Web Audio playback engine. Owns the AudioContext, one
 * GainNode per track for independent volume control plus a master GainNode
 * all tracks route through, and playback state. UI/React state is derived
 * via subscribe() — this class holds no React state.
 *
 * Designed for a scene's music slots: multiple tracks can play concurrently,
 * each with its own fade in/out and volume, and can be crossfaded into one
 * another. One-shot slots are a separate, simpler concept: triggerOneShot()
 * always creates a new fire-and-forget source, so overlapping and rapid
 * re-triggering of the same slot just works. The engine itself has no fixed
 * slot limit — the 10/20-slots-per-scene rule lives in the data model, not
 * here.
 */
export class AudioEngine {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private masterVolume = 1;
  private tracks = new Map<string, Track>();
  private oneShots = new Map<string, OneShotSlot>();
  private listeners = new Set<Listener>();

  private ensureContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = this.masterVolume;
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

  private getOneShotSlot(id: string): OneShotSlot {
    const slot = this.oneShots.get(id);
    if (!slot) throw new Error(`Unknown one-shot slot: ${id}`);
    return slot;
  }

  private clearFadeTimer(track: Track): void {
    if (track.fadeTimer !== null) {
      clearTimeout(track.fadeTimer);
      track.fadeTimer = null;
    }
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

  getState(): EngineState {
    const tracks: Record<string, TrackState> = {};
    for (const [id, track] of this.tracks) {
      tracks[id] = {
        id,
        name: track.name,
        duration: track.buffer.duration,
        isPlaying: track.source !== null,
        loop: track.loop,
        volume: track.volume,
        fading: track.fadeTimer !== null,
      };
    }
    const oneShots: Record<string, OneShotState> = {};
    for (const [id, slot] of this.oneShots) {
      oneShots[id] = {
        id,
        name: slot.name,
        duration: slot.buffer.duration,
        volume: slot.volume,
        activeCount: slot.activeSources.size,
      };
    }

    return { tracks, oneShots, masterVolume: this.masterVolume };
  }

  async loadTrack(id: string, name: string, data: ArrayBuffer): Promise<void> {
    // Loading into a slot that already holds a track (re-assigning the slot)
    // must stop and disconnect the previous one first, or it keeps playing
    // silently orphaned from the returned state.
    if (this.tracks.has(id)) this.removeTrack(id);

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
      fadeTimer: null,
    });
    this.notify();
  }

  async loadOneShot(id: string, name: string, data: ArrayBuffer): Promise<void> {
    // Same replace-in-place rule as loadTrack: re-assigning a slot stops
    // whatever was previously triggered from it.
    if (this.oneShots.has(id)) this.removeOneShotSlot(id);

    const ctx = this.ensureContext();
    const buffer = await ctx.decodeAudioData(data);
    const gainNode = ctx.createGain();
    gainNode.connect(this.masterGain!);
    this.oneShots.set(id, {
      name,
      buffer,
      gainNode,
      volume: 1,
      activeSources: new Set(),
    });
    this.notify();
  }

  /**
   * Fires a brand-new, independent instance of the slot's sound. Never
   * touches instances already in flight — repeated triggers (even of the
   * same slot, even before the previous instance finished) overlap freely
   * and each cleans itself up via onended.
   */
  triggerOneShot(id: string): void {
    const slot = this.getOneShotSlot(id);
    const ctx = this.ensureContext();
    const source = ctx.createBufferSource();
    source.buffer = slot.buffer;
    source.connect(slot.gainNode);
    slot.activeSources.add(source);
    source.onended = () => {
      slot.activeSources.delete(source);
      source.disconnect();
      this.notify();
    };
    source.start(0);
    this.notify();
  }

  /** Volume applied to every current and future instance of this one-shot slot. */
  setOneShotVolume(id: string, volume: number): void {
    const slot = this.getOneShotSlot(id);
    const clamped = Math.min(1, Math.max(0, volume));
    slot.volume = clamped;
    slot.gainNode.gain.setValueAtTime(clamped, this.ensureContext().currentTime);
    this.notify();
  }

  removeOneShotSlot(id: string): void {
    const slot = this.oneShots.get(id);
    if (!slot) return;
    for (const source of slot.activeSources) {
      source.onended = null;
      source.stop();
      source.disconnect();
    }
    slot.activeSources.clear();
    slot.gainNode.disconnect();
    this.oneShots.delete(id);
    this.notify();
  }

  private startSource(track: Track, ctx: AudioContext): void {
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
  }

  /** Applies a linear or exponential ramp on a track's GainNode to `target` over `durationMs`. */
  private rampGain(track: Track, target: number, durationMs: number, curve: FadeCurve): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    const durationSec = Math.max(0, durationMs) / 1000;
    const gain = track.gainNode.gain;
    gain.cancelScheduledValues(now);

    if (durationSec === 0) {
      gain.setValueAtTime(target, now);
      return;
    }

    if (curve === "exponential") {
      const start = Math.max(gain.value, MIN_GAIN);
      gain.setValueAtTime(start, now);
      const end = Math.max(target, MIN_GAIN);
      gain.exponentialRampToValueAtTime(end, now + durationSec);
      if (target <= MIN_GAIN) gain.setValueAtTime(0, now + durationSec);
    } else {
      gain.setValueAtTime(gain.value, now);
      gain.linearRampToValueAtTime(target, now + durationSec);
    }
  }

  play(id: string): void {
    const track = this.getTrack(id);
    if (track.source) return;
    this.clearFadeTimer(track);
    const ctx = this.ensureContext();
    track.gainNode.gain.cancelScheduledValues(ctx.currentTime);
    track.gainNode.gain.setValueAtTime(track.volume, ctx.currentTime);
    this.startSource(track, ctx);
    this.notify();
  }

  pause(id: string): void {
    const track = this.getTrack(id);
    this.clearFadeTimer(track);
    if (!track.source) return;
    const ctx = this.ensureContext();
    track.gainNode.gain.cancelScheduledValues(ctx.currentTime);
    track.offset = (ctx.currentTime - track.startedAt) % track.buffer.duration;
    track.source.onended = null;
    track.source.stop();
    track.source = null;
    this.notify();
  }

  stop(id: string): void {
    const track = this.getTrack(id);
    this.clearFadeTimer(track);
    const ctx = this.ensureContext();
    track.gainNode.gain.cancelScheduledValues(ctx.currentTime);
    track.gainNode.gain.setValueAtTime(track.volume, ctx.currentTime);
    if (track.source) {
      track.source.onended = null;
      track.source.stop();
      track.source = null;
    }
    track.offset = 0;
    this.notify();
  }

  /**
   * Starts (if stopped) or turns up (if already playing) a track, ramping
   * its gain up to `targetVolume` (default: the track's current volume)
   * over `durationMs`.
   */
  fadeIn(
    id: string,
    durationMs: number,
    options: { targetVolume?: number; curve?: FadeCurve } = {},
  ): void {
    const track = this.getTrack(id);
    const ctx = this.ensureContext();
    const target = options.targetVolume ?? track.volume;
    const curve = options.curve ?? "linear";

    this.clearFadeTimer(track);
    track.volume = target;

    if (!track.source) {
      track.gainNode.gain.cancelScheduledValues(ctx.currentTime);
      track.gainNode.gain.setValueAtTime(0, ctx.currentTime);
      this.startSource(track, ctx);
    }

    this.rampGain(track, target, durationMs, curve);

    if (durationMs > 0) {
      track.fadeTimer = setTimeout(() => {
        track.fadeTimer = null;
        this.notify();
      }, durationMs);
    }
    this.notify();
  }

  /**
   * Ramps a track's gain down to silence over `durationMs`, then stops it
   * (pass `stop: false` to leave the source running silently instead).
   */
  fadeOut(id: string, durationMs: number, options: { curve?: FadeCurve; stop?: boolean } = {}): void {
    const track = this.getTrack(id);
    if (!track.source) return;
    const curve = options.curve ?? "linear";
    const shouldStop = options.stop ?? true;

    this.clearFadeTimer(track);
    this.rampGain(track, 0, durationMs, curve);

    track.fadeTimer = setTimeout(() => {
      track.fadeTimer = null;
      if (shouldStop) {
        this.stop(id);
      } else {
        this.notify();
      }
    }, durationMs);
    this.notify();
  }

  /** Fades `fromId` out and `toId` in over the same duration, in lockstep. */
  crossfade(
    fromId: string,
    toId: string,
    durationMs: number,
    options: { curve?: FadeCurve; targetVolume?: number } = {},
  ): void {
    if (fromId === toId) return;
    this.fadeOut(fromId, durationMs, { curve: options.curve });
    this.fadeIn(toId, durationMs, { curve: options.curve, targetVolume: options.targetVolume });
  }

  setVolume(id: string, volume: number): void {
    const track = this.getTrack(id);
    const clamped = Math.min(1, Math.max(0, volume));
    const ctx = this.ensureContext();
    this.clearFadeTimer(track);
    track.volume = clamped;
    track.gainNode.gain.cancelScheduledValues(ctx.currentTime);
    track.gainNode.gain.setValueAtTime(clamped, ctx.currentTime);
    this.notify();
  }

  setLoop(id: string, loop: boolean): void {
    const track = this.getTrack(id);
    track.loop = loop;
    if (track.source) track.source.loop = loop;
    this.notify();
  }

  /** Scene-wide volume multiplier applied after every track's own gain. */
  setMasterVolume(volume: number, durationMs = 15): void {
    const clamped = Math.min(1, Math.max(0, volume));
    this.masterVolume = clamped;
    const ctx = this.ensureContext();
    const gain = this.masterGain!.gain;
    const now = ctx.currentTime;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(clamped, now + Math.max(0, durationMs) / 1000);
    this.notify();
  }

  removeTrack(id: string): void {
    const track = this.tracks.get(id);
    if (!track) return;
    this.clearFadeTimer(track);
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
    for (const id of [...this.oneShots.keys()]) this.removeOneShotSlot(id);
    this.listeners.clear();
    void this.audioContext?.close();
    this.audioContext = null;
    this.masterGain = null;
  }
}
