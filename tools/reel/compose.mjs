/* The teaser reel's ffmpeg (DECISIONS #105): frames and how long each stood
   become a clip at 60 frames a second, constant, in H.264; a card becomes a
   clip of its picture; and the clips are joined, cut to cut. Called by
   tools/reel/reel.mjs, which says what the film is.

   The ffmpeg is tools/reel's own, ffmpeg-static, pinned in a package beside
   this file so that the root `npm ci` never fetches it; where that is not
   installed, one on the PATH. Playwright's own encodes VP8 alone. It must
   have libx264, or nothing is rendered. No text is drawn here: every word is
   in a PNG that cards.html drew, laid on with `overlay`. */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FPS = 60;
/* What every clip is encoded as, so that the join copies them as they are. */
const ENCODE = ["-c:v", "libx264", "-preset", "medium", "-crf", "14", "-pix_fmt", "yuv420p", "-r", String(FPS), "-video_track_timescale", "15360",
  "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-movflags", "+faststart", "-an"];
/* RGB to the file's own: BT.709, the range a player expects. */
const TO_FILE = "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p";

function run(ffmpeg, args, what) {
  const done = spawnSync(ffmpeg, ["-hide_banner", "-y", ...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (done.error) throw new Error(`reel: ffmpeg did not run for ${what}: ${done.error.message}`);
  if (done.status !== 0) throw new Error(`reel: ffmpeg failed on ${what}:\n${String(done.stderr).trim().split("\n").slice(-12).join("\n")}`);
  return done;
}

/* The ffmpeg to use, and what it says of libx264: the line of `-encoders`
   that names it. */
function findFfmpeg() {
  let ffmpeg = null;
  try { ffmpeg = createRequire(path.join(HERE, "package.json"))("ffmpeg-static"); } catch (e) { /* not installed */ }
  if (!ffmpeg || !fs.existsSync(ffmpeg)) ffmpeg = "ffmpeg";
  const asked = spawnSync(ffmpeg, ["-hide_banner", "-encoders"], { encoding: "utf8" });
  if (asked.error || asked.status !== 0) {
    throw new Error("reel: no ffmpeg. Install the reel's own, once: `npm --prefix tools/reel ci` (ffmpeg-static, pinned; its install fetches the binary).");
  }
  const libx264 = String(asked.stdout).split("\n").map(line => line.trim()).find(line => /\slibx264\s/.test(line));
  if (!libx264) throw new Error(`reel: ${ffmpeg} has no libx264, and the film is H.264: nothing rendered.`);
  return { ffmpeg, libx264 };
}

/* A beat's clip: the ground with its caption, the frames on it where the
   phone stands, each for as long as it stood, and the phone's corners and
   edge over them. frames: [{file, ms}], in order. */
function beatClip({ ffmpeg, ground, frame, frames, phone, out }) {
  const list = out.replace(/\.mp4$/, ".frames.txt");
  const quoted = file => `file '${file.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`;
  /* the concat demuxer drops the last duration unless the last file is named once more */
  fs.writeFileSync(list, ["ffconcat version 1.0", ...frames.flatMap(f => [quoted(f.file), `duration ${(f.ms / 1000).toFixed(6)}`]), quoted(frames[frames.length - 1].file), ""].join("\n"));
  const seconds = frames.reduce((sum, f) => sum + f.ms, 0) / 1000;
  run(ffmpeg, [
    "-loop", "1", "-framerate", String(FPS), "-i", ground,
    "-f", "concat", "-safe", "0", "-i", list,
    "-loop", "1", "-framerate", String(FPS), "-i", frame,
    "-filter_complex", `[1:v]fps=${FPS},format=rgb24[shot];[0:v]format=rgb24[ground];[ground][shot]overlay=${phone.x}:${phone.y}:format=rgb[on];[on][2:v]overlay=0:0:format=rgb,${TO_FILE}[v]`,
    "-map", "[v]", "-t", seconds.toFixed(3), ...ENCODE, out,
  ], path.basename(out));
  fs.rmSync(list);
  return seconds;
}

/* A card's clip: its picture, held. */
function cardClip({ ffmpeg, picture, seconds, out }) {
  run(ffmpeg, ["-loop", "1", "-framerate", String(FPS), "-i", picture, "-vf", `format=rgb24,${TO_FILE}`, "-t", String(seconds), ...ENCODE, out], path.basename(out));
  return seconds;
}

/* The clips, one after another, as they are: a plain cut between two. */
function join({ ffmpeg, clips, out }) {
  const list = out.replace(/\.mp4$/, ".clips.txt");
  fs.writeFileSync(list, ["ffconcat version 1.0", ...clips.map(clip => `file '${clip.replace(/\\/g, "/")}'`), ""].join("\n"));
  run(ffmpeg, ["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", "-movflags", "+faststart", out], path.basename(out));
  fs.rmSync(list);
}

/* One frame of a clip as a PNG, the one at `at` seconds, or the last. */
function still({ ffmpeg, clip, at, out }) {
  run(ffmpeg, at === undefined ? ["-sseof", "-0.2", "-i", clip, "-update", "1", "-q:v", "1", out] : ["-ss", at.toFixed(3), "-i", clip, "-frames:v", "1", "-update", "1", out], path.basename(out));
}

/* What a file is, as ffmpeg reads it - there is no ffprobe here: the codec,
   the pixel format, the size, the frames a second and the length. */
function facts(ffmpeg, file) {
  const said = String(spawnSync(ffmpeg, ["-hide_banner", "-i", file], { encoding: "utf8" }).stderr);
  const video = /Stream #0:0.*Video: (\w+).*?, (\w+)(?:\([^)]*\))?, (\d+)x(\d+).*?([\d.]+) fps/.exec(said), length = /Duration: (\d+):(\d+):([\d.]+)/.exec(said);
  if (!video || !length) throw new Error(`reel: ffmpeg could not read ${file}:\n${said.trim().split("\n").slice(-6).join("\n")}`);
  return { codec: video[1], pixels: video[2], width: Number(video[3]), height: Number(video[4]), fps: Number(video[5]),
    seconds: Number(length[1]) * 3600 + Number(length[2]) * 60 + Number(length[3]) };
}

export { FPS, findFfmpeg, beatClip, cardClip, join, still, facts };
