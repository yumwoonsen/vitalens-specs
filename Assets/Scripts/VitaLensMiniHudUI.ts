// VitalLens head-locked status. Two surfaces, one shown at a time; all record actions go
// through Main's reducer.
// - Spec strip (lens-spec.json strip): shown with the one-panel screens and while minimised.
//   Rigidly head-locked, centred at the top of the view, it hugs its content and has no Menu
//   (Menu is in the panel). It is always shown: nothing hides or moves it. While the dashboard
//   is minimised a row hangs from its bottom edge as one joined unit with the five dock buttons
//   (Back, Privacy, Restore, Code blue, Next): the same buttons and intents as the full dock, smaller.
// - Compact status (kiro/proposal): the corner HUD and its menu, for the views that are
//   not one-panel screens yet: emergency, handover and the older cards. Privacy is a one-panel
//   screen on every routine view, so it uses the spec strip.
import Event,{PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {BackPlate} from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import {RoundedRectangle} from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangle"
import type {selectStatusRail} from "./Core/EncounterSelectors"
import type {DockAction} from "./VitaLensDockUI"
import type {EncounterEvent} from "./Core/EncounterTypes"
import {followAlpha,hudOffset} from "./Core/WardLayout"
import {applyTextRole,Box,box,button,cm,hex,icon,label,obj,panel,placeBox,placeLabel,setBorder,setControl,setSolidEnabled,setSolidFill,setText,setViewerPosition,setWeight,show,solidButton,SolidButton,UiButton} from "./VitaLensSharedUI"

type RailView=ReturnType<typeof selectStatusRail>

const ICON_BACK=requireAsset("../Icons/Storyboard/back.png") as Texture
const ICON_PRIVACY=requireAsset("../Icons/Storyboard/eyeoff.png") as Texture
const ICON_MINIMISE=requireAsset("../Icons/Storyboard/mini.png") as Texture
const ICON_EMERGENCY=requireAsset("../Icons/Storyboard/emerg.png") as Texture
const ICON_NEXT=requireAsset("../Icons/Storyboard/next.png") as Texture

// The strip's top edge, in cm above the view centre at 110 cm. The preview camera's top
// edge is at +36.37 (110 × tan(fov / 2)), below the +38.5 of the 53 × 77 cm binocular area.
// It sits TOP_GAP below that edge so the strip does not touch the frame.
const TOP_GAP=0.9
const TOP_EDGE=36.3-TOP_GAP
// The same space at the left and right ends of the strip: the patient text is left-aligned at it, and
// the step text is right-aligned to it, so neither end depends on how long its text is.
const SIDE_PAD=1.1
const SHIFT=SIDE_PAD-0.08

// Strip geometry. Text keeps its size, so a width never goes below the measured text.
const ROW1_ID=cm(2.71)
const ROW1_NO_ID=cm(2.18)
const ROW2=cm(2.26)
const PATIENT_W=cm(12.03)
const PILL_X=cm(12.8)
const PILL_Y=cm(0.33)
const PILL_H=cm(2.21)
const PILL_W={none:Math.max(cm(9.52),8.2),ok:Math.max(cm(6.97),5.7),bad:Math.max(cm(13.75),12.44)}
// "Privacy on" at 1.4 cm, estimated from "Verified" (5.06 cm for 8 characters), plus the same padding.
const PRIVACY_PILL_W=7.1
const PRIVACY_INK=hex("#CCFBF1")
const MODE_GAP=cm(0.6)
const MODE_W:{readonly [mode:string]:number}={Shift:cm(9.41),Verify:cm(9.41),Overview:cm(11.54),Note:cm(8.85)}
const NO_ID_W=cm(17)
const NO_ID_PATIENT_W=cm(7.4)
const NEXT_LABEL_W=2.4
// While recording the patient text is 1.4 cm (spec hs-v) with the REC dot beside it.
const REC_PATIENT_W=11
const REC_DOT_X=11.1+SHIFT
const REC_DOT_SIZE=cm(1)
const REC_PILL_X=12.4

// Docked row (the dashboard minimised): hangs from the strip's bottom edge, the same glass and border, no gap.
// The plate reaches DOCK_TUCK up behind the strip, so its top corners and border are hidden and the unit reads as one.
// The five dock buttons are icon-only here, so the row stays quiet for the nurse: a small icon on a 2.4 cm face, no
// text, with about the same space above and below as the top HUD's rows. Each keeps a hit area of 4 x 4 cm, which
// reaches a little past the plate (invisible padding), and the slots touch (DOCK_SLOT_GAP apart), so no two overlap.
// State without words: Restore is the minimise icon turned over, Privacy is filled while on, Code blue is red.
const DOCK_H=3.4
const DOCK_TUCK=0.5
const DOCK_SLIDE_S=0.2
const DOCK_PAD=0.7
const DOCK_HIT_H=4
const DOCK_SLOT_GAP=0.2
const DOCK_INSET=0.25
const DOCK_VIS_H=2.4
const DOCK_ICON=1.2
const DOCK_SLOT={back:4,privacy:4,minimise:4,emergency:4,next:4}
const DOCK_ORDER:readonly DockAction[]=["back","privacy","minimise","emergency","next"]

// Deliberate deviation from the storyboard's 0.35 tint, set before PANEL_PLATE existed.
const GLASS=hex("#1C2329",0.9)
const PLATE_LINE=hex("#FFFFFF",0.16)
const HAIRLINE=hex("#FFFFFF",0.12)
const NEUTRAL_FILL=hex("#FFFFFF",0.12)
const OK_FILL=hex("#34D399",0.18)
const OK_INK=hex("#34D399")
const BAD_LINE=hex("#EF4444")
const SOFT_INK=hex("#C9D1D8")
const REC_DOT=hex("#F87171")
const WHITE_INK=hex("#FFFFFF")
const CLEAR=hex("#FFFFFF",0)
const EMERGENCY_FILL=hex("#F87171",0.1)
const EMERGENCY_INK=hex("#FCA5A5")

/** The five dock buttons as the screens show them: enabled or not, plus the two states the row displays. */
export interface DockRow {
 readonly back:boolean
 readonly privacy:boolean
 readonly minimise:boolean
 readonly emergency:boolean
 readonly next:boolean
 readonly privacyOn:boolean
 /** A real recording is running. */
 readonly rec:boolean
}

@component
export class VitaLensMiniHudUI extends BaseScriptComponent {
 @input cameraObject!:SceneObject
 @input consoleRoot!:SceneObject
 @input distanceCm:number=110
 @input offset:vec2=new vec2(0,26)
 @input followRate:number=8
 @input reducedMotion:boolean=false
 private readonly expandEvent=new Event<void>()
 private readonly menuEvent=new Event<void>()
 private readonly intent=new Event<EncounterEvent>()
 private readonly motion=new Event<boolean>()
 private readonly dockPressed=new Event<DockAction>()
 private readonly mirror=new Event<boolean>()
 private mirrored=false
 get onExpand():PublicApi<void>{return this.expandEvent.publicApi()}
 get onMenu():PublicApi<void>{return this.menuEvent.publicApi()}
 /** A button of the docked row was pressed: the same actions as the full dock. */
 get onDock():PublicApi<DockAction>{return this.dockPressed.publicApi()}
 get onIntent():PublicApi<EncounterEvent>{return this.intent.publicApi()}
 get onMirror():PublicApi<boolean>{return this.mirror.publicApi()}
 get onMotion():PublicApi<boolean>{return this.motion.publicApi()}
 private strip:SceneObject|null=null
 private menu:SceneObject|null=null
 private recall:UiButton|null=null
 private privacy:UiButton|null=null
 private v:RailView|null=null
 private layout=""
 private emergency=false
 private snapped=false
 private side:"left"|"right"="right"
 private width=22

 // Spec strip.
 private useSpecStrip=false
 private specRoot!:SceneObject
 private specPlate!:BackPlate
 private specContent!:SceneObject
 private specPatient!:Text
 private specRec!:Box
 private specPill!:Box
 private specPillText!:Text
 private specMode!:Text
 private specLine!:Box
 private specNextLabel!:Text
 private specNext!:Text
 private stripH=0

 // Docked row.
 private dockRoot!:SceneObject
 private dockPlateHost!:SceneObject
 private dockPlate!:BackPlate
 private dockContent!:SceneObject
 private dockButtons!:{[K in DockAction]:SolidButton}
 private dockRow:DockRow|null=null
 private dockOn=false
 private dockT=1

 onAwake():void {
  this.sceneObject.createComponent("Component.Canvas")
  this.buildSpecStrip()
  this.buildDock()
  show(this.specRoot,false)
  // Late update, so the head lock takes this frame's final pose rather than trailing by a frame.
  this.createEvent("LateUpdateEvent").bind(()=>this.follow())
 }

 /** Use the spec strip. Main calls this before render(). */
 setSpecStrip(on:boolean):void {
  if(on!==this.useSpecStrip)this.snapped=false
  this.useSpecStrip=on
 }

 /** The docked row's button states. Main calls this before render(), every time the screens render. */
 setDockRow(row:DockRow|null):void {
  this.dockRow=row
 }

 private buildSpecStrip():void {
  this.specRoot=obj(this.sceneObject,"SpecStrip")
  const plateHost=obj(this.specRoot,"SpecStripPlate",new vec3(0,-ROW2,0))
  this.specPlate=plateHost.createComponent(BackPlate.getTypeName()) as BackPlate
  this.specPlate.size=new vec2(NO_ID_W,ROW1_NO_ID+ROW2+0.17)
  this.specPlate.style="simple"
  this.specPlate.onInitialized.add(()=>{
   const rr=plateHost.getComponent(RoundedRectangle.getTypeName()) as RoundedRectangle
   rr.gradient=false
   rr.backgroundColor=GLASS
   rr.cornerRadius=cm(1.2)
   setBorder(rr,{w:0.08,c:PLATE_LINE})
  })
  this.specContent=obj(this.specRoot,"SpecStripContent")
  const c=this.specContent
  this.specPatient=label(c,0,0,1,1,"",1.17,400,WHITE_INK,{align:"left",name:"MiniHudPatientCompact"})
  this.specRec=box(c,REC_DOT_X,cm(0.94),REC_DOT_SIZE,REC_DOT_SIZE,REC_DOT,REC_DOT_SIZE/2)
  this.specPill=box(c,0,0,1,1,NEUTRAL_FILL,PILL_H/2)
  this.specPillText=label(c,0,0,1,1,"",1.4,600,WHITE_INK,{align:"center",name:"MiniHudIdCompact"})
  this.specMode=label(c,0,0,1,1,"",1.17,400,WHITE_INK,{align:"right",name:"MiniHudModeCompact"})
  this.specLine=box(c,0,0,1,0.08,HAIRLINE)
  this.specNextLabel=label(c,0,0,1,1,"",1.17,400,SOFT_INK,{align:"right",name:"MiniHudNextLabelCompact"})
  this.specNext=label(c,0,0,1,1,"",1.17,400,WHITE_INK,{name:"MiniHudNextCompact"})
 }

 private renderSpecStrip(v:RailView):void {
  const s=v.strip
  const id=s.idState
  // Storyboard strip: "Privacy on" takes the ID pill's place while privacy hides the patient.
  const priv=!id&&v.privacyOn
  const pill=id!==null||priv
  const pillW=id?PILL_W[id]:priv?PRIVACY_PILL_W:0
  const row1=pill?ROW1_ID:ROW1_NO_ID
  const h=row1+ROW2+0.17
  const modeW=MODE_W[s.mode.split(" ")[0]]??MODE_W.Verify
  const privPatientW=Math.max(NO_ID_PATIENT_W,s.patient.length*0.62)
  const pillX=priv?SIDE_PAD+privPatientW+MODE_GAP:(s.rec?REC_PILL_X:PILL_X)+SHIFT
  const w=pill?pillX+pillW+MODE_GAP+modeW+SIDE_PAD:SIDE_PAD+NO_ID_PATIENT_W+modeW+SIDE_PAD
  this.stripH=h
  // While docked the unit is as wide as the docked row needs; the strip's own content stays centred.
  const row=v.minimised?this.dockRow:null
  const W=Math.max(w,row?this.dockNeed(row):0)
  this.specPlate.size=new vec2(W,h)
  this.specPlate.getSceneObject().getTransform().setLocalPosition(new vec3(0,-h/2,0))
  this.specContent.getTransform().setLocalPosition(new vec3(-w/2,0,0))
  placeLabel(this.specPatient,SIDE_PAD,0.08,id?(s.rec?REC_PATIENT_W:PATIENT_W):priv?privPatientW:NO_ID_PATIENT_W,row1)
  setText(this.specPatient,s.patient)
  applyTextRole(this.specPatient,"Label",s.rec?1.4:1.17)
  setWeight(this.specPatient,s.rec?600:400)
  show(this.specRec.so,s.rec)
  show(this.specPill.so,pill)
  show(this.specPillText.getSceneObject(),pill)
  if(pill){
   placeBox(this.specPill,pillX,PILL_Y,pillW,PILL_H)
   placeLabel(this.specPillText,pillX,PILL_Y,pillW,PILL_H)
   setText(this.specPillText,priv?"Privacy on":s.idText??"",id==="ok"?OK_INK:priv?PRIVACY_INK:WHITE_INK)
   this.specPill.rr.backgroundColor=id==="ok"?OK_FILL:NEUTRAL_FILL
   setBorder(this.specPill.rr,id==="ok"?{w:0.17,c:OK_INK}:id==="bad"?{w:0.17,c:BAD_LINE}:null)
  }
  placeLabel(this.specMode,pill?pillX+pillW+MODE_GAP:SIDE_PAD+NO_ID_PATIENT_W,0.08,modeW,row1)
  setText(this.specMode,s.mode)
  placeBox(this.specLine,0.08-(W-w)/2,row1+0.08,W-0.16,0.08)
  const y2=row1+0.16
  const needW=s.need.length*0.6
  const start=Math.max(0.2,(w-NEXT_LABEL_W-0.6-needW)/2)
  placeLabel(this.specNextLabel,start,y2,NEXT_LABEL_W,ROW2)
  setText(this.specNextLabel,s.nextLabel)
  placeLabel(this.specNext,start+NEXT_LABEL_W+0.6,y2,w-start-NEXT_LABEL_W-0.8,ROW2)
  setText(this.specNext,s.need)
  this.renderDock(row,W)
 }


 /** The row docked under the strip while the dashboard is minimised. Built once; laid out in renderDock. */
 private buildDock():void {
  this.dockRoot=obj(this.specRoot,"DockedRoot")
  this.dockPlateHost=obj(this.dockRoot,"DockedPlate",new vec3(0,0,-0.2))
  this.dockPlate=this.dockPlateHost.createComponent(BackPlate.getTypeName()) as BackPlate
  this.dockPlate.size=new vec2(NO_ID_W,DOCK_H+DOCK_TUCK)
  this.dockPlate.style="simple"
  this.dockPlate.onInitialized.add(()=>{
   const rr=this.dockPlateHost.getComponent(RoundedRectangle.getTypeName()) as RoundedRectangle
   rr.gradient=false
   rr.backgroundColor=GLASS
   rr.cornerRadius=cm(1.2)
   setBorder(rr,{w:0.08,c:PLATE_LINE})
   // Drawn before the strip, so the strip's bottom edge blends over the tucked part instead of showing a seam.
   const stripVisual=this.specPlate.getSceneObject().getComponent("Component.RenderMeshVisual") as RenderMeshVisual
   const dockVisual=this.dockPlateHost.getComponent("Component.RenderMeshVisual") as RenderMeshVisual
   if(stripVisual&&dockVisual)dockVisual.setRenderOrder(stripVisual.getRenderOrder()-1)
  })
  this.dockContent=obj(this.dockRoot,"DockedContent")
  const c=this.dockContent
  const add=(action:DockAction,name:string,tex:Texture,ink:vec4,fill:vec4):SolidButton=>{
   const slot=DOCK_SLOT[action]
   const vw=slot-DOCK_INSET*2
   const b=solidButton(c,name,0,0,vw,DOCK_VIS_H,fill,cm(1.2),()=>this.dockPressed.invoke(action))
   b.icons.push(icon(b.face,tex,(vw-DOCK_ICON)/2,(DOCK_VIS_H-DOCK_ICON)/2,DOCK_ICON,ink))
   // The face is smaller than the target: the hit area is the whole slot, at least 4 cm either way.
   b.button.size=new vec3(slot,DOCK_HIT_H,1)
   return b
  }
  this.dockButtons={
   back:add("back","BtnDockedBack",ICON_BACK,WHITE_INK,CLEAR),
   privacy:add("privacy","BtnDockedPrivacy",ICON_PRIVACY,WHITE_INK,CLEAR),
   minimise:add("minimise","BtnDockedRestore",ICON_MINIMISE,WHITE_INK,CLEAR),
   emergency:add("emergency","BtnDockedCodeBlue",ICON_EMERGENCY,EMERGENCY_INK,EMERGENCY_FILL),
   next:add("next","BtnDockedNext",ICON_NEXT,WHITE_INK,CLEAR),
  }
  // The same icon as Minimise, turned over: this one brings the dashboard back.
  this.dockButtons.minimise.icons[0].getSceneObject().getTransform().setLocalRotation(quat.fromEulerAngles(0,0,Math.PI))
 }

 /** The width the docked row needs: five slots and their gaps. A recording shows on the top HUD, not here. */
 private dockNeed(row:DockRow):number {
  const slots=DOCK_ORDER.reduce((sum,a)=>sum+DOCK_SLOT[a],0)+DOCK_SLOT_GAP*(DOCK_ORDER.length-1)
  return DOCK_PAD+slots+DOCK_PAD
 }

 /** Lays the row out at width W, sets the button states, and starts the slide when it first appears. */
 private renderDock(row:DockRow|null,W:number):void {
  const on=!!row
  if(on&&!this.dockOn)this.dockT=this.reducedMotion?1:0
  this.dockOn=on
  show(this.dockRoot,on)
  if(!row)return
  this.dockPlate.size=new vec2(W,DOCK_H+DOCK_TUCK)
  this.dockPlateHost.getTransform().setLocalPosition(new vec3(0,-DOCK_H/2+DOCK_TUCK/2,-0.2))
  this.dockContent.getTransform().setLocalPosition(new vec3(-W/2,0,0))
  let x=(W-this.dockNeed(row))/2+DOCK_PAD
  for(const action of DOCK_ORDER){
   const b=this.dockButtons[action]
   b.cell.getTransform().setLocalPosition(new vec3(x+DOCK_INSET,-(DOCK_H-DOCK_VIS_H)/2,0))
   setSolidEnabled(b,row[action])
   x+=DOCK_SLOT[action]+DOCK_SLOT_GAP
  }
  // Privacy shows its state without words: the button is filled while privacy is on.
  setSolidFill(this.dockButtons.privacy,row.privacyOn?NEUTRAL_FILL:CLEAR)
  this.placeDock()
 }

 /** One move: the row slides down out of the strip in DOCK_SLIDE_S, then its content shows. */
 private placeDock():void {
  const e=1-(1-this.dockT)*(1-this.dockT)
  this.dockRoot.getTransform().setLocalPosition(new vec3(0,-this.stripH+(1-e)*DOCK_H,0))
  show(this.dockContent,this.dockT>=1)
 }

 private stepDock():void {
  if(!this.dockOn||this.dockT>=1)return
  this.dockT=Math.min(1,this.dockT+getDeltaTime()/DOCK_SLIDE_S)
  this.placeDock()
 }

 private retire(root:SceneObject):void {
  root.enabled=false
  const e=this.createEvent("DelayedCallbackEvent");e.bind(()=>{root.destroy();e.enabled=false});e.reset(2)
 }
 private build(compact:boolean):void {
  if(this.strip)this.retire(this.strip)
  this.width=compact?12:22
  const p=panel(this.sceneObject,"CompactStatus",this.width,5,vec3.zero(),{padX:0.2,padY:0.2,gap:0})
  this.strip=p.root
  this.recall=button(p.column,"BtnCompactMenu","Menu",this.width-0.4,4.5,()=>{
   if(this.menu)this.menu.enabled=!this.menu.enabled
  })
  if(this.menu)this.retire(this.menu)
  const m=panel(this.sceneObject,"CompactMenu",22,43.5,new vec3(0,-25,0),{gap:2,padY:1,padX:1})
  this.menu=m.root
  const add=(name:string,label:string,fn:()=>void)=>button(m.column,name,label,20,4.5,()=>{if(this.menu)this.menu.enabled=false;fn()})
  this.privacy=add("BtnCompactPrivacy","Privacy",()=>this.intent.invoke({type:this.v?.privacyOn?"PRIVACY_OFF":"PRIVACY_ON"}))
  add("BtnCompactCorner","Switch HUD side",()=>this.intent.invoke({type:"SET_MINI_CORNER",corner:this.side==="right"?"left":"right"}))
  add("BtnCompactRestore",this.emergency?"Simulate call":"Restore board",()=>this.emergency?this.intent.invoke({type:"EMERGENCY_CONTACT"}):this.expandEvent.invoke())
  add("BtnCompactMinimise",this.emergency?"Doctor briefing":"Minimise board",()=>this.intent.invoke({type:this.emergency?"EMERGENCY_BRIEF":"MINIMISE"}))
  add("BtnCompactMotion","Reduce motion",()=>{this.reducedMotion=!this.reducedMotion;this.motion.invoke(this.reducedMotion)})
  add("BtnCompactMirror","Mirror bedside",()=>{this.mirrored=!this.mirrored;this.mirror.invoke(this.mirrored)})
  this.menu.enabled=false
 }
 render(v:RailView):void {
  this.v=v;this.side=v.miniCorner;
  show(this.specRoot,this.useSpecStrip)
  if(this.useSpecStrip){
   if(this.strip)show(this.strip,false)
   if(this.menu)show(this.menu,false)
   this.renderSpecStrip(v)
   return
  }
  if(this.strip)show(this.strip,true)
  if(v.phaseLabel==="Boot" && this.menu)this.menu.enabled=false;
  if(v.mode==="emergency" && !v.privacyOn)return
  this.emergency=false
  const compact=!v.minimised && !!v.patientLine
  const key=compact?"bedside":"walking"
  if(key!==this.layout){this.layout=key;this.build(compact)}
  if(this.recall?.label)setText(this.recall.label,v.privacyOn?"Privacy on · Menu":v.recVisible?"REC · Menu":compact?"Bedside · Menu":v.minimised?"Restore / Menu":v.nextWardNeed??"VitalLens · Menu")
  if(this.privacy?.label)setText(this.privacy.label,v.privacyOn?"Restore details":"Privacy")
 }
 renderEmergencyStatus(timer:string,contact:boolean):void {
  this.emergency=true
  if(this.layout!=="emergency"){this.layout="emergency";this.build(true)}
  this.sceneObject.enabled=true
  if(this.recall?.label)setText(this.recall.label,contact?"Bed 3 · Call simulated":"Bed 3 · Menu")
 }
 private follow():void {
  if(!this.cameraObject)return
  this.stepDock()
  const cam=this.cameraObject.getTransform(),rot=cam.getWorldRotation()
  setViewerPosition(cam.getWorldPosition())
  const t=this.sceneObject.getTransform()
  if(this.useSpecStrip){
   // The spec strip is rigid: no smoothing.
   t.setWorldPosition(cam.getWorldPosition().add(rot.multiplyVec3(new vec3(0,TOP_EDGE,-this.distanceCm))))
   t.setWorldRotation(rot)
   return
  }
  const o=hudOffset(this.width,5,this.side)
  const target=cam.getWorldPosition().add(rot.multiplyVec3(new vec3(o.x,o.y,-this.distanceCm)))
  const k=this.snapped?followAlpha(getDeltaTime(),this.followRate):1
  this.snapped=true;t.setWorldPosition(vec3.lerp(t.getWorldPosition(),target,k));t.setWorldRotation(quat.slerp(t.getWorldRotation(),rot,k))
 }
}
