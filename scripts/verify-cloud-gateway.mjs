import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createCloudReadGateway } from "../load/cloud-read-gateway.mjs";
let publicRenders = 0;
const upstream = createServer((req,res)=>{
  if(req.url === "/demande-cours") { assert.equal(req.headers.cookie,undefined); publicRenders++; res.setHeader("Content-Type","text/html");res.end("<html>Real shared public form</html>");return; }
  res.setHeader("Content-Type","application/json");res.end(JSON.stringify({unreadCount:1}));
});
let sockets=0;upstream.on("connection",()=>sockets++);
await new Promise(resolve=>upstream.listen(0,"127.0.0.1",resolve));
const gateway=createCloudReadGateway({ports:[upstream.address().port],proof:{dataset:"synthetic"}});
await new Promise(resolve=>gateway.server.listen(0,"127.0.0.1",resolve));
const origin="http://127.0.0.1:"+gateway.server.address().port;
try {
  for(let i=0;i<20;i++){const r=await fetch(origin+"/api/client/notifications");assert.equal(r.status,200);assert.equal((await r.json()).unreadCount,1);}
  assert.equal(sockets,1,"Completed responses must reuse the same upstream TCP connection");
  for(let i=0;i<3;i++){const r=await fetch(origin+"/demande-cours",{headers:{accept:"text/html",cookie:"private-test-"+i}});assert.equal(await r.text(),"<html>Real shared public form</html>");assert.equal(r.headers.get("x-competence-intake-cache"),i===0?"MISS":"HIT");}
  assert.equal(publicRenders,1);assert.equal(gateway.cacheStats.hits,2);
  assert.equal((await fetch(origin+"/api/client/notifications",{method:"POST"})).status,405);
  assert.equal((await fetch(origin+"/api/admin/finance")).status,404);
  console.log("PASS cloud gateway: private responses reuse sockets, never share cache; public rendering uses the production policy; mutations/unrelated paths blocked.");
} finally {await gateway.close();upstream.closeAllConnections();await new Promise(resolve=>upstream.close(resolve));}
