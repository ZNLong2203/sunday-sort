/**
 * SundaySortAudio — the three chimes.
 *
 * Owns: the Done chime and the "Week ready" chime (played at the user's head),
 *       and the nudge chime, which is SPATIAL and lives on the shelf so it is
 *       heard from the shelf's direction (from the left while working on the box).
 *       Keeps play counters so tests can assert a chime fired.
 * Expects: three AudioTrackAssets and nudgeSource (an authored SceneObject at the
 *          shelf bottle). Needs an AudioListener on the camera for spatial audio.
 * Must NOT: decide when to play — Main calls playDone()/playNudge()/playWeekReady().
 */

@component
export class SundaySortAudio extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">SundaySortAudio – soft chimes (nudge is spatial, from the shelf)</span>')
  @ui.separator

  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @hint("Soft chime when a bottle is marked Done.")
  doneChime: AudioTrackAsset

  @input
  @hint("Single soft chime for the out-of-view bottle (mono, so it can be placed in space).")
  nudgeChime: AudioTrackAsset

  @input
  @hint("Chime when the week is finished ('Week ready').")
  weekReadyChime: AudioTrackAsset

  @input
  @hint("SceneObject at the shelf bottle — the nudge chime plays from here.")
  nudgeSource: SceneObject
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @hint("Volume of the Done and Week ready chimes.")
  @widget(new SliderWidget(0, 1, 0.05))
  chimeVolume: number = 0.7

  @input
  @hint("Volume of the spatial nudge chime.")
  @widget(new SliderWidget(0, 1, 0.05))
  nudgeVolume: number = 0.9
  @ui.group_end

  private done: AudioComponent
  private week: AudioComponent
  private nudge: AudioComponent
  private counts: {[name: string]: number} = {done: 0, nudge: 0, weekReady: 0}

  onAwake(): void {
    this.done = this.makePlayer(this.getSceneObject(), "DoneChimeAudio", this.doneChime, this.chimeVolume, false)
    this.week = this.makePlayer(this.getSceneObject(), "WeekReadyChimeAudio", this.weekReadyChime, this.chimeVolume, false)
    const host = this.nudgeSource ? this.nudgeSource : this.getSceneObject()
    this.nudge = this.makePlayer(host, "NudgeChimeAudio", this.nudgeChime, this.nudgeVolume, true)
    this.createEvent("OnStartEvent").bind(() => {
      // Specs: input-reactive cues want LowLatency (the default LowPower adds lag).
      this.done.playbackMode = Audio.PlaybackMode.LowLatency
      this.week.playbackMode = Audio.PlaybackMode.LowLatency
    })
  }

  playDone(): void {
    this.play(this.done, "done")
  }

  playNudge(): void {
    this.play(this.nudge, "nudge")
  }

  playWeekReady(): void {
    this.play(this.week, "weekReady")
  }

  /** How many times a chime has been played this session ("done" | "nudge" | "weekReady"). */
  playCount(name: string): number {
    return this.counts[name] || 0
  }

  /** World position the nudge chime is emitted from. */
  nudgeSourceWorld(): vec3 {
    return this.nudge.getSceneObject().getTransform().getWorldPosition()
  }

  private play(a: AudioComponent, name: string): void {
    this.counts[name] = (this.counts[name] || 0) + 1
    if (!a || !a.audioTrack) return
    if (a.isPlaying()) a.stop(false)
    a.play(1)
  }

  private makePlayer(host: SceneObject, name: string, track: AudioTrackAsset, volume: number, spatial: boolean): AudioComponent {
    const so = global.scene.createSceneObject(name)
    so.setParent(host)
    const a = so.createComponent("Component.AudioComponent") as AudioComponent
    if (track) a.audioTrack = track
    a.volume = volume
    if (spatial) {
      a.spatialAudio.enabled = true
      a.spatialAudio.positionEffect.enabled = true
      a.spatialAudio.distanceEffect.enabled = true
      a.spatialAudio.distanceEffect.minDistance = 30
      a.spatialAudio.distanceEffect.maxDistance = 600
    }
    return a
  }
}
