// Renders one representative still per scene for each composition into out/stills/.
// Mirrors the timing math in src/timeline.ts (Node strips types from script.ts natively).
import { readFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { SCRIPT } from "../src/script.ts";

const FPS = 30;
const manifest = JSON.parse(readFileSync(new URL("../src/vo-manifest.json", import.meta.url)));
// Where in each scene to grab the still (fraction of scene length) — after the key motion lands.
const AT = { hook: 0.6, problem: 0.75, intro: 0.9, how: 0.83, developers: 0.93, status: 0.8, outro: 0.8 };

let from = 0;
const frames = SCRIPT.map((s) => {
  const vo = manifest.scenes[s.id];
  const dur = Math.round((vo ? vo.seconds + 0.5 : s.fallbackSeconds) * FPS);
  const f = { id: s.id, frame: from + Math.round(dur * AT[s.id]) };
  from += dur;
  return f;
});

mkdirSync("out/stills", { recursive: true });
const comps = process.argv.slice(2).length ? process.argv.slice(2) : ["XeroIntro", "XeroIntroSquare"];
for (const comp of comps) {
  frames.forEach(({ id, frame }, i) => {
    const out = `out/stills/${comp}-${i + 1}-${id}.png`;
    execFileSync("npx", ["remotion", "still", comp, out, `--frame=${frame}`, "--log=error"], { stdio: "inherit" });
    console.log(out);
  });
}
