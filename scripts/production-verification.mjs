import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

const checks = [];
const check = (name, ok, detail = "") => checks.push({ name, ok, detail });
check("direct provider adapter", existsSync("packages/ai/src/ifec-platform.ts"));
check("AI protocol", existsSync("packages/ai/src/protocol.ts"));
check("tool executor", existsSync("packages/ai/src/tools.ts"));
check("FFmpeg renderer", existsSync("packages/render/src/compositor.ts"));
check("Ultimate resources preserved", existsSync("integrations/ultimate-master/backend"));
check("production env template", existsSync("env.example"));
try { execFileSync("ffmpeg", ["-version"], { stdio: "ignore" }); check("ffmpeg available", true); } catch { check("ffmpeg available", false, "Install ffmpeg for render verification"); }
for (const c of checks) console.log(`${c.ok ? "PASS" : "FAIL"} ${c.name}${c.detail ? ` — ${c.detail}` : ""}`);
if (checks.some(c => !c.ok)) process.exitCode = 1;
