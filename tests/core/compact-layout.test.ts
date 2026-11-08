import {test} from "node:test"
import assert from "node:assert/strict"
import {followAlpha,hudOffset,proximityEvent,previewBed} from "../../Assets/Scripts/Core/WardLayout"
import {selectCards} from "../../Assets/Scripts/Core/CardPresentation"
import {createInitialState,reduce} from "../../Assets/Scripts/Core/EncounterReducer"
import {run,VERIFY} from "./helpers"
const verified=()=>run([{type:"START_DEMO"},{type:"CLOCK_IN"},{type:"SELECT_BED",bedId:"bed2"},...VERIFY],createInitialState())
test("compact tabs render state and do not grant consent or save",()=>{
 const s=verified(),v=selectCards(s);assert.deepEqual(v.tabs.map(t=>t.label),["Summary","Care","Note"])
 const n=reduce(s,v.tabs[2].event);assert.equal(n.bodyView,"note");assert.equal(n.capture,"idle");assert.equal(n.consent,"unasked");assert.equal(n.note,null)
})
test("leaving via a tab interrupts capture; returning cannot restart",()=>{
 const s=run([{type:"OPEN_NOTE"},{type:"GRANT_CONSENT"},{type:"START_CAPTURE"}],verified())
 const c=reduce(s,selectCards(s).tabs[1].event);assert.equal(c.capture,"interrupted")
 const n=reduce(c,selectCards(c).tabs[2].event);assert.equal(n.capture,"interrupted")
})
test("proximity hysteresis rejects boundary jitter",()=>{
 assert.equal(proximityEvent(false,139),"enter");assert.equal(proximityEvent(true,169),null)
 assert.equal(proximityEvent(true,171),"exit");assert.equal(proximityEvent(false,141),null)
})
test("follow damping is independent of frame subdivision",()=>{
 const one=followAlpha(1/30),half=followAlpha(1/60);assert.ok(Math.abs(one-(1-(1-half)**2))<1e-10)
})
test("both travel HUD corners retain margins and remain above centre",()=>{
 for(const side of ["left","right"] as const){const p=hudOffset(24,20,side);assert.ok(Math.abs(p.x)+12<=24.5);assert.ok(p.y-10>=0);assert.ok(p.y+10<=36.5)}
 assert.deepEqual(previewBed("bed2"),[-240,-95,-425])
})
test("compact summary retains care elsewhere and privacy removes identifiers",()=>{
 const s=verified();assert.equal(selectCards(s).vitals.length,6)
 assert.ok(selectCards(reduce(s,{type:"OPEN_CARE"})).rows.some(r=>r.label==="Pending task"))
 const p=selectCards(reduce(s,{type:"PRIVACY_ON"}));assert.equal(p.title,"Patient information hidden");assert.equal(p.tabs.length,0)
})
