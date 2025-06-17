//  send_sessions.js  ——  node send_sessions.js  (ONE session per request)
//  HOSNY fixed: two Crashing → OOM, two Satisfying → normal.

import axios from "axios";
import fs    from "fs";
import crypto from "crypto";


const TOTAL_SESSIONS = 100;
const DAYS_BACK      = 10;          // today - 10d
const MIN_GAP_MINS   = 15;         
const PAUSE_MS       = 4_000;     //do not change



const cfg = JSON.parse(fs.readFileSync("./config.json","utf8"));
const TEMPLATE = JSON.parse(
  fs.readFileSync("./v3.json","utf8")
    .replace(/{{\s*config\.application_token\s*}}/g,cfg.application_token)
);

const ENDPOINT = "https://backend-applications-819.instabug-dev.com/api/sdk/v3/sessions/v3";
const HDRS = {
  Host:"backend-applications-819.instabug-dev.com","content-type":"application/json",accept:"*/*",
  "ibg-os":"ios","ibg-sdk-version":"8.0.17","ibg-app-token":cfg.application_token,
  "user-agent":"InstabugDemo/4 CFNetwork/1568.300.101 Darwin/24.3.0",
  "app-version":"1.0 (4)"
};

/* two OOM (→ Crashing) + two normal (→ Satisfying) */
const SKINS = [
  { label:"Crashing", term:"OOM",   os:"18.2", dev:"arm64",   f:1,t:0, bugs:4 },
  { label:"Crashing", term:"OOM",   os:"17.5", dev:"arm64e",  f:0,t:1, bugs:1 },
  { label:"Satisfying",term:"",     os:"16.7", dev:"armv7",   f:0,t:2, bugs:0 },
  { label:"Satisfying",term:"",     os:"15.6", dev:"x86_64",  f:2,t:1, bugs:3 }
];

//helpers 
const patchUploadPaths = (node,stem) => {
  if(!node||typeof node!=="object") return;
  if(Array.isArray(node)){ node.forEach(n=>patchUploadPaths(n,stem)); return; }
  for(const k in node){
    const v=node[k];
    if(typeof v==="string" && v.includes("/sessions/"))
      node[k]=v.replace(/sessions\/[^/]+/,`sessions/${stem}`);
    else patchUploadPaths(v,stem);
  }
};

// pick unique timestamp (≥ MIN_GAP_MINS apart on same day) 
const taken=new Map();
const pickTs = () => {
  const now=Date.now(), from=now-DAYS_BACK*864e5;
  for(let i=0;i<1e3;i++){
    const ts = Math.floor(Math.random()*(now-from))+from;
    const key=new Date(ts).toISOString().slice(0,10);
    const day=taken.get(key)??new Set();
    if([...day].every(p=>Math.abs(p-ts)>=MIN_GAP_MINS*60e3)){
      day.add(ts); taken.set(key,day); return ts;
    }
  }
  throw Error("no free 15-min slot – relax MIN_GAP_MINS?");
};

// build ONE ready-to-fire body 
const makeBody = idx => {
  const b  = JSON.parse(JSON.stringify(TEMPLATE));
  const ts = pickTs();

  /* keep ONE replay object */
  if(Array.isArray(b.ses)&&b.ses.length>1) b.ses.splice(1);
  const r=b.ses[0];

  // common timestamp + upload paths 
  b.start_time = r.start_time = ts;
  b.fs         = ts*1_000;
  const stem   = `${cfg.application_token}-${ts}-${b.pid}`;
  patchUploadPaths(b,stem);

  // apply skin 
  const s = SKINS[idx % SKINS.length];

  // root device / OS (nice to see in dashboard list)
  b.de = r.device = s.dev;
  b.os = r.os     = s.os;

  r.session_type     = s.label;          // harmless, for completeness
  r.termination_type = s.term;

  // launches metrics to make “Frustrating” vs “Satisfying” obvious 
  r.performance ??= { launches:{frustrating:0,tolerable:0} };
  r.performance.launches.frustrating = s.f;
  r.performance.launches.tolerable   = s.t;
  r.broken_functionality_count       = s.bugs;

  // OOM block required when termination_type is OOM 
  if(s.term==="OOM"){
    r.cd ??= {};
    r.cd.oom = [crypto.randomUUID()];
  } else if(r.cd?.oom){
    delete r.cd.oom;
    if(Object.keys(r.cd).length===0) delete r.cd;
  }

  /* unique marker */
  b.custom_data ??= {};
  b.custom_data.__uniq = crypto.randomUUID();

  const when = new Date(ts).toISOString().replace("T"," ").replace("Z","");
  return {body:b, when};
};

// main
(async ()=>{
  console.log(`🚀 TOTAL ${TOTAL_SESSIONS} • window today-${DAYS_BACK}d • gap ≥${MIN_GAP_MINS}min`);
  for(let i=0;i<TOTAL_SESSIONS;i++){
    const {body,when} = makeBody(i);
    try{
      await axios.post(ENDPOINT,body,{headers:HDRS});
      console.log(`✅ ${i+1}/${TOTAL_SESSIONS} @ ${when} (${body.ses[0].session_type})`);
    }catch(e){
      console.error(`❌ ${i+1}/${TOTAL_SESSIONS} @ ${when}`,e.message);
    }
    if(i+1<TOTAL_SESSIONS) await new Promise(r=>setTimeout(r,PAUSE_MS));
  }
})();
