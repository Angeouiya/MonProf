import assert from "node:assert/strict";
import inspector from "node:inspector";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
assert.equal(process.platform, "linux");
assert.equal(process.env.GITHUB_ACTIONS, "true");
assert.equal(process.env.GITHUB_REPOSITORY, "Angeouiya/MonProf");
assert.ok(process.send, "Profiler control requires the private parent IPC channel");
const session = new inspector.Session();
session.connect();
const post = method => new Promise((resolve, reject) => session.post(method, (error, result) => error ? reject(error) : resolve(result)));
let profiling = false;
process.on("message", async message => {
  if (!message || !["profile-start", "profile-stop"].includes(message.command)) return;
  try {
    if (message.command === "profile-start") {
      await post("Profiler.enable"); await post("Profiler.start"); profiling = true;
      process.send({ type: "profile-start:done" });
    } else if (profiling) {
      const { profile } = await post("Profiler.stop"); profiling = false;
      const nodes = new Map(profile.nodes.map(node => [node.id, node]));
      const times = new Map();
      for (let i = 0; i < profile.samples.length; i++) times.set(profile.samples[i], (times.get(profile.samples[i]) || 0) + (profile.timeDeltas[i] || 0));
      const total = [...times.values()].reduce((sum, value) => sum + value, 0);
      const hot = [...times].sort((a,b)=>b[1]-a[1]).slice(0,35).map(([id,time])=>{
        const frame = nodes.get(id).callFrame;
        let excerpt = "";
        try {
          const filename = frame.url.startsWith("file:") ? fileURLToPath(frame.url) : frame.url;
          if (filename.includes(".next/") || filename.includes(".next\\")) {
            const line = fs.readFileSync(filename,"utf8").split(/\r?\n/)[frame.lineNumber] || "";
            excerpt = line.slice(Math.max(0,frame.columnNumber-40),frame.columnNumber+180);
          }
        } catch {}
        return { name:frame.functionName, file:frame.url, line:frame.lineNumber+1, column:frame.columnNumber, selfPercent:Math.round(time/total*10000)/100, excerpt };
      });
      fs.writeFileSync(path.join(process.env.CAPACITY_PROFILE_DIR,"cpu-"+process.env.PORT+".json"),JSON.stringify(profile));
      process.send({ type:"profile-stop:done", port:process.env.PORT, hot });
    }
  } catch (error) { process.send({ type:message.command+":done", error:error.message }); }
});
await import(pathToFileURL(path.resolve(".next/standalone/server.js")).href);
