export type FadeCurve = "linear" | "exponential";

export type TrackState = {
  id: string;
  name: string;
  duration: number;
  isPlaying: boolean;
  loop: boolean;
  volume: number;
  muted: boolean;
  /** True from the moment a fadeIn/fadeOut is asked for until its ramp lands. */
  fading: boolean;
};

export type OneShotState = {
  id: string;
  name: string;
  duration: number;
  volume: number;
  /** When set, a triggered instance repeats until it is stopped. */
  loop: boolean;
  /** How many overlapping instances of this slot are currently playing. */
  activeCount: number;
};

export type GroupState = {
  volume: number;
};

export type EngineState = {
  tracks: Record<string, TrackState>;
  oneShots: Record<string, OneShotState>;
  masterVolume: number;
  groups: Record<string, GroupState>;
};

type Track = {
  name: string;
  /**
   * Music streams from a media element rather than a decoded AudioBuffer.
   * decodeAudioData inflates a file to raw float PCM — a 74 MB, 65-minute
   * track becomes ~1.4 GB in memory, which kills the tab outright on iPad.
   *
   * The element is also left out of the Web Audio graph entirely and driven by
   * its own `volume`. Routing it through createMediaElementSource costs nothing
   * on desktop but is a well-known source of silence on iOS: the node needs a
   * CORS-clean response to avoid being muted as tainted media, and it depends
   * on an AudioContext unlocked by a user gesture. Neither risk buys us
   * anything here — every effect music needs is a volume multiplier.
   */
  element: HTMLAudioElement;
  groupId: string;
  muted: boolean;
  /** Target volume (0-1) — what the slider shows, independent of any fade in flight. */
  volume: number;
  /** 0-1 multiplier owned by fadeIn/fadeOut; 1 when no fade has run. */
  fadeGain: number;
  fadeTimer: ReturnType<typeof setInterval> | null;
  /**
   * Set while a fade in is holding at silence, waiting for the element to
   * actually start; calling it drops that wait.
   */
  cancelPendingFade: (() => void) | null;
  /** Set when the track owns an object URL (local File) and must revoke it. */
  objectUrl: string | null;
};

type OneShotSlot = {
  name: string;
  buffer: AudioBuffer;
  /** Shared by every overlapping instance of this slot, so slot volume affects all of them at once. */
  gainNode: GainNode;
  volume: number;
  /** Applied to instances as they are triggered, and to those already in flight. */
  loop: boolean;
  activeSources: Set<AudioBufferSourceNode>;
};

type Listener = (state: EngineState) => void;

/** Step size for music fades, driven by a timer rather than AudioParam automation. */
const FADE_STEP_MS = 25;

/** Bus every one-shot slot routes through, so they share one fader. */
export const ONESHOT_GROUP_ID = "oneshots";

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
  /**
   * A group is just a fader value. Only the one-shot bus needs a real GainNode,
   * since one-shots are the only thing still going through Web Audio; music
   * groups apply their volume as a multiplier on each element instead.
   */
  private groups = new Map<string, { gainNode: GainNode | null; volume: number }>();
  private listeners = new Set<Listener>();
  /** Set while disposeWithFade's ramp is running; see subscribe(). */
  private pendingDisposeTimer: ReturnType<typeof setTimeout> | null = null;

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

  /** Registers a group's fader without pulling an AudioContext into existence. */
  private ensureGroup(groupId: string): { gainNode: GainNode | null; volume: number } {
    let group = this.groups.get(groupId);
    if (!group) {
      group = { gainNode: null, volume: 1 };
      this.groups.set(groupId, group);
    }
    return group;
  }

  /** The one-shot bus is the only group backed by a real node. */
  private ensureGroupGain(groupId: string): GainNode {
    const ctx = this.ensureContext();
    const group = this.ensureGroup(groupId);
    if (!group.gainNode) {
      group.gainNode = ctx.createGain();
      group.gainNode.gain.value = group.volume;
      group.gainNode.connect(this.masterGain!);
    }
    return group.gainNode;
  }

  /** Collapses every fader that applies to a music track into the element's own volume. */
  private applyTrackVolume(track: Track): void {
    const groupVolume = this.groups.get(track.groupId)?.volume ?? 1;
    const level = track.muted
      ? 0
      : track.volume * track.fadeGain * groupVolume * this.masterVolume;
    track.element.volume = Math.min(1, Math.max(0, level));
  }

  /** Ends whatever fade a track has in flight — a running ramp, or one still waiting to start. */
  private clearFade(track: Track): void {
    if (track.fadeTimer !== null) {
      clearInterval(track.fadeTimer);
      track.fadeTimer = null;
    }
    if (track.cancelPendingFade) {
      const cancel = track.cancelPendingFade;
      track.cancelPendingFade = null;
      cancel();
    }
  }

  private notify(): void {
    const snapshot = this.getState();
    for (const listener of this.listeners) listener(snapshot);
  }

  subscribe(listener: Listener): () => void {
    // A new subscriber means the engine is wanted after all — React's
    // development double-mount unsubscribes and resubscribes the same engine,
    // and a teardown scheduled in between would land on a live one.
    if (this.pendingDisposeTimer !== null) {
      clearTimeout(this.pendingDisposeTimer);
      this.pendingDisposeTimer = null;
      for (const track of this.tracks.values()) {
        this.clearFade(track);
        track.fadeGain = 1;
        this.applyTrackVolume(track);
      }
    }
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
        // NaN until the element has metadata; the UI treats 0 as "not known yet".
        duration: Number.isFinite(track.element.duration) ? track.element.duration : 0,
        isPlaying: !track.element.paused && !track.element.ended,
        loop: track.element.loop,
        volume: track.volume,
        muted: track.muted,
        fading: track.fadeTimer !== null || track.cancelPendingFade !== null,
      };
    }
    const oneShots: Record<string, OneShotState> = {};
    for (const [id, slot] of this.oneShots) {
      oneShots[id] = {
        id,
        name: slot.name,
        duration: slot.buffer.duration,
        volume: slot.volume,
        loop: slot.loop,
        activeCount: slot.activeSources.size,
      };
    }

    const groups: Record<string, GroupState> = {};
    for (const [id, group] of this.groups) {
      groups[id] = { volume: group.volume };
    }

    return { tracks, oneShots, masterVolume: this.masterVolume, groups };
  }

  /**
   * Streams `url` into a music slot. Resolves once the element has metadata, so
   * callers can surface a real failure (bad URL, blocked by CORS, unsupported
   * codec) instead of leaving a silent slot behind.
   */
  async loadTrack(
    id: string,
    name: string,
    url: string,
    groupId: string,
    options: { volume?: number; loop?: boolean; objectUrl?: string | null } = {},
  ): Promise<void> {
    const { volume: initialVolume = 1, loop = false, objectUrl = null } = options;
    const element = new Audio();
    // No crossOrigin: the element never enters the Web Audio graph, so there is
    // nothing to taint, and plain <audio> playback needs no CORS at all.
    element.preload = "auto";
    // Set before the source is live so a slot restored as looping loops from its
    // very first play, not only once someone touches the toggle.
    element.loop = loop;
    element.src = url;

    try {
      await new Promise<void>((resolve, reject) => {
        const onLoaded = () => {
          cleanup();
          resolve();
        };
        const onError = () => {
          cleanup();
          reject(new Error(element.error?.message ?? `Kunde inte ladda ${name}`));
        };
        const cleanup = () => {
          element.removeEventListener("loadedmetadata", onLoaded);
          element.removeEventListener("error", onError);
        };
        element.addEventListener("loadedmetadata", onLoaded);
        element.addEventListener("error", onError);
        element.load();
      });
    } catch (err) {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      throw err;
    }

    this.ensureGroup(groupId);

    // A looping element normally restarts itself and never fires "ended" at all,
    // but it does end when the browser can't pin the media's duration down (a
    // stream without a usable length, a file whose metadata says nothing). Winding
    // it back by hand means "loop på" holds in that case too. Otherwise this just
    // keeps the UI honest about a track that reached its end on its own.
    element.addEventListener("ended", () => {
      const current = this.tracks.get(id);
      // Only for the track this element still belongs to — a reassigned slot's
      // old element must not drag the new one's playback along with it.
      if (current?.element === element && element.loop) {
        element.currentTime = 0;
        this.startElement(current);
      }
      this.notify();
    });

    // Checked right before committing (not before the await above) so that if two
    // loads for the same slot overlap — e.g. a retry click racing the initial load —
    // whichever resolves last still tears down whatever the other one left behind,
    // even if that track had already started playing in the meantime.
    if (this.tracks.has(id)) this.removeTrack(id);
    const track: Track = {
      name,
      element,
      groupId,
      muted: false,
      volume: Math.min(1, Math.max(0, initialVolume)),
      fadeGain: 1,
      fadeTimer: null,
      cancelPendingFade: null,
      objectUrl,
    };
    this.applyTrackVolume(track);
    this.tracks.set(id, track);
    this.notify();
  }

  async loadOneShot(
    id: string,
    name: string,
    data: ArrayBuffer,
    options: { volume?: number; loop?: boolean } = {},
  ): Promise<void> {
    const ctx = this.ensureContext();
    const buffer = await ctx.decodeAudioData(data);
    const gainNode = ctx.createGain();
    const volume = Math.min(1, Math.max(0, options.volume ?? 1));
    gainNode.gain.value = volume;
    // Routed through a shared bus rather than straight to master, so one-shots
    // can be faded as a group independently of the music columns.
    gainNode.connect(this.ensureGroupGain(ONESHOT_GROUP_ID));
    // Same replace-in-place rule as loadTrack: checked right before committing so an
    // overlapping load for the same slot can't silently orphan an already-triggered slot.
    if (this.oneShots.has(id)) this.removeOneShotSlot(id);
    this.oneShots.set(id, {
      name,
      buffer,
      gainNode,
      volume,
      loop: options.loop ?? false,
      activeSources: new Set(),
    });
    this.notify();
  }

  /**
   * Fires a brand-new, independent instance of the slot's sound. Never
   * touches instances already in flight — repeated triggers (even of the
   * same slot, even before the previous instance finished) overlap freely
   * and each cleans itself up via onended.
   *
   * A looping slot's instance never ends on its own; stopOneShot is what ends
   * it, which is what the pad's second press does.
   */
  triggerOneShot(id: string): void {
    const slot = this.getOneShotSlot(id);
    const ctx = this.ensureContext();
    const source = ctx.createBufferSource();
    source.buffer = slot.buffer;
    source.loop = slot.loop;
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

  /** Stops every instance of this one-shot slot currently in flight, without discarding the slot itself. */
  stopOneShot(id: string): void {
    const slot = this.getOneShotSlot(id);
    for (const source of slot.activeSources) {
      source.onended = null;
      source.stop();
      source.disconnect();
    }
    slot.activeSources.clear();
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

  /**
   * Turns looping on or off for this slot. Applied to instances already
   * playing as well: turning it off mid-loop lets the sound finish its current
   * pass and stop by itself, which is gentler than cutting it, and turning it
   * on catches a sound that is still running.
   */
  setOneShotLoop(id: string, loop: boolean): void {
    const slot = this.getOneShotSlot(id);
    slot.loop = loop;
    for (const source of slot.activeSources) source.loop = loop;
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

  /**
   * Starts the element, tolerating the autoplay rejection browsers raise off-gesture.
   *
   * `onStarted` runs when the first sample is actually audible, which is not
   * when play() is called: a track the browser still has to buffer — ten slots
   * of streamed music compete for connections, so "preload" is no guarantee —
   * can take a second or more to come in. Both the `playing` event and play()'s
   * own promise mark that moment; whichever lands first wins.
   */
  private startElement(track: Track, onStarted?: () => void): void {
    if (!onStarted) {
      void track.element.play().catch(() => this.notify());
      return;
    }

    const element = track.element;
    let settled = false;
    const started = () => {
      if (settled) return;
      settled = true;
      element.removeEventListener("playing", started);
      track.cancelPendingFade = null;
      onStarted();
    };

    track.cancelPendingFade = () => {
      settled = true;
      element.removeEventListener("playing", started);
    };
    element.addEventListener("playing", started);

    void element.play().then(started, () => {
      if (settled) return;
      settled = true;
      element.removeEventListener("playing", started);
      track.cancelPendingFade = null;
      // Nothing is going to play, so the slot must not be left silenced behind
      // a fade that will never run.
      track.fadeGain = 1;
      this.applyTrackVolume(track);
      this.notify();
    });
  }

  /**
   * Ramps a track's fade multiplier to `target` over `durationMs`, then runs
   * `onDone`. Stepped from a timer rather than scheduled on an AudioParam,
   * because the element's `volume` is a plain property with no automation of
   * its own. FADE_STEP_MS is well below the threshold where a level change
   * becomes audible as a step.
   */
  private rampFade(
    track: Track,
    target: number,
    durationMs: number,
    curve: FadeCurve,
    onDone?: () => void,
  ): void {
    this.clearFade(track);
    const from = track.fadeGain;
    const duration = Math.max(0, durationMs);

    if (duration === 0) {
      track.fadeGain = target;
      this.applyTrackVolume(track);
      onDone?.();
      this.notify();
      return;
    }

    const startedAt = Date.now();
    track.fadeTimer = setInterval(() => {
      const progress = Math.min(1, (Date.now() - startedAt) / duration);
      // Perceived loudness tracks roughly the square of amplitude, so an
      // "exponential" fade eases the amplitude rather than moving it linearly.
      const shaped = curve === "exponential" ? progress * progress : progress;
      track.fadeGain = from + (target - from) * shaped;
      this.applyTrackVolume(track);

      if (progress >= 1) {
        this.clearFade(track);
        track.fadeGain = target;
        this.applyTrackVolume(track);
        onDone?.();
        this.notify();
      }
    }, FADE_STEP_MS);
    this.notify();
  }

  play(id: string): void {
    const track = this.getTrack(id);
    if (!track.element.paused) return;
    this.clearFade(track);
    // An instant start always begins at full level, undoing any fade left behind.
    track.fadeGain = 1;
    this.applyTrackVolume(track);
    this.startElement(track);
    this.notify();
  }

  pause(id: string): void {
    const track = this.getTrack(id);
    this.clearFade(track);
    if (track.element.paused) return;
    track.element.pause();
    this.notify();
  }

  stop(id: string): void {
    const track = this.getTrack(id);
    this.clearFade(track);
    track.fadeGain = 1;
    this.applyTrackVolume(track);
    track.element.pause();
    track.element.currentTime = 0;
    this.notify();
  }

  /**
   * Current playback position in seconds. Deliberately not part of EngineState —
   * it advances continuously, so callers poll it at whatever rate their UI needs
   * instead of every listener re-rendering on each frame.
   */
  getPosition(id: string): number {
    const track = this.tracks.get(id);
    if (!track) return 0;
    return track.element.currentTime;
  }

  /** Jumps to `positionSeconds`; gain, fades, mute and loop are unaffected. */
  seek(id: string, positionSeconds: number): void {
    const track = this.getTrack(id);
    const duration = track.element.duration;
    if (!Number.isFinite(duration)) return;
    let position = Math.min(Math.max(0, positionSeconds), duration);

    if (position >= duration) {
      // Landing exactly on the end wraps a looping track; for a one-shot play
      // it means "finished", which stop() already models.
      if (!track.element.loop) {
        this.stop(id);
        return;
      }
      position = 0;
    }

    track.element.currentTime = position;
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
    const target = options.targetVolume ?? track.volume;
    const curve = options.curve ?? "linear";

    this.clearFade(track);
    track.volume = target;

    if (track.element.paused) {
      track.fadeGain = 0;
      this.applyTrackVolume(track);
      // Held at silence until playback really begins. Ramping from here instead
      // would spend the buffering wait fading up nothing, and the track would
      // arrive already half way in — the reason a fade in could go unheard
      // while the fade out, on a track long since playing, rang out in full.
      this.startElement(track, () => this.rampFade(track, 1, durationMs, curve));
      this.notify();
      return;
    }

    this.rampFade(track, 1, durationMs, curve);
    this.notify();
  }

  /**
   * Ramps a track's gain down to silence over `durationMs`, then stops it
   * (pass `stop: false` to leave the source running silently instead).
   */
  fadeOut(
    id: string,
    durationMs: number,
    options: { curve?: FadeCurve; then?: "stop" | "pause" | "none" } = {},
  ): void {
    const track = this.getTrack(id);
    if (track.element.paused) return;
    const curve = options.curve ?? "linear";
    const settle = options.then ?? "stop";

    this.rampFade(track, 0, durationMs, curve, () => {
      // "pause" keeps the playhead where the fade left it, so a later fade in
      // resumes rather than restarts — what a master play/pause toggle implies.
      if (settle === "stop") this.stop(id);
      else if (settle === "pause") this.pause(id);
    });
  }

  /**
   * Fades `fromId` out and `toId` in over the same duration. The incoming
   * track's ramp begins when it is audible rather than when it is asked for,
   * so a cold track slides in a little behind the outgoing one instead of
   * appearing mid-fade.
   */
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
    this.clearFade(track);
    track.volume = Math.min(1, Math.max(0, volume));
    // Dragging the fader mid-fade is a deliberate override of that fade.
    track.fadeGain = 1;
    this.applyTrackVolume(track);
    this.notify();
  }

  setLoop(id: string, loop: boolean): void {
    const track = this.getTrack(id);
    track.element.loop = loop;
    this.notify();
  }

  /** Silences (or restores) a track without touching its volume/fade state. */
  setMuted(id: string, muted: boolean): void {
    const track = this.getTrack(id);
    track.muted = muted;
    this.applyTrackVolume(track);
    this.notify();
  }

  /** Scene-wide volume multiplier applied on top of every track's own level. */
  setMasterVolume(volume: number): void {
    const clamped = Math.min(1, Math.max(0, volume));
    this.masterVolume = clamped;
    // One-shots are still a Web Audio graph, so master lives in two places.
    if (this.masterGain && this.audioContext) {
      const now = this.audioContext.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(clamped, now);
    }
    for (const track of this.tracks.values()) this.applyTrackVolume(track);
    this.notify();
  }

  /** Bus volume for a group of tracks (e.g. one mixer column). */
  setGroupVolume(groupId: string, volume: number): void {
    const clamped = Math.min(1, Math.max(0, volume));
    const group = this.ensureGroup(groupId);
    group.volume = clamped;
    if (group.gainNode && this.audioContext) {
      const now = this.audioContext.currentTime;
      group.gainNode.gain.cancelScheduledValues(now);
      group.gainNode.gain.setValueAtTime(clamped, now);
    }
    for (const track of this.tracks.values()) {
      if (track.groupId === groupId) this.applyTrackVolume(track);
    }
    this.notify();
  }

  removeTrack(id: string): void {
    const track = this.tracks.get(id);
    if (!track) return;
    this.clearFade(track);
    track.element.pause();
    // Dropping the src lets the browser release the buffered stream straight away.
    track.element.removeAttribute("src");
    track.element.load();
    if (track.objectUrl) URL.revokeObjectURL(track.objectUrl);
    this.tracks.delete(id);
    this.notify();
  }

  /**
   * Fades everything currently playing down to silence over `durationMs` and
   * then tears the engine down. For the case the plain `dispose()` handles
   * badly: leaving a scene mid-session cuts every track off in the same frame,
   * which at the table sounds like the app crashed rather than like a scene
   * change.
   *
   * Detached from the caller on purpose — whoever navigates away is already
   * unmounting and can't await this. The elements and nodes being ramped are
   * held by this engine alone, so they stay alive until the ramp lands.
   */
  disposeWithFade(durationMs: number): void {
    const playing = [...this.tracks.values()].filter((track) => !track.element.paused);
    if (playing.length === 0 || durationMs <= 0) {
      this.dispose();
      return;
    }

    // Listeners go first: the React tree that owned them is on its way out, and
    // notifying it from a timer after unmount is a state update to nothing.
    this.listeners.clear();
    for (const track of playing) {
      this.rampFade(track, 0, durationMs, "linear");
    }
    // One timer for the lot rather than a callback per track, so disposal
    // happens exactly once no matter how many ramps are in flight.
    this.pendingDisposeTimer = setTimeout(() => {
      this.pendingDisposeTimer = null;
      this.dispose();
    }, durationMs);
  }

  dispose(): void {
    if (this.pendingDisposeTimer !== null) {
      clearTimeout(this.pendingDisposeTimer);
      this.pendingDisposeTimer = null;
    }
    for (const id of [...this.tracks.keys()]) this.removeTrack(id);
    for (const id of [...this.oneShots.keys()]) this.removeOneShotSlot(id);
    for (const group of this.groups.values()) group.gainNode?.disconnect();
    this.groups.clear();
    this.listeners.clear();
    void this.audioContext?.close();
    this.audioContext = null;
    this.masterGain = null;
  }
}
