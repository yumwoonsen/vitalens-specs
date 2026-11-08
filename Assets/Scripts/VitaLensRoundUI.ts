// Accepted clinical cards. Passive UIKit view: no state mutations or business guards.
import Event,{PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {ScrollWindow} from "SpectaclesUIKit.lspkg/Scripts/Components/ScrollWindow/ScrollWindow"
import {BackPlate} from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import {RoundedRectangle} from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangle"
import {BED_PIN, BedMarkerStyle, CODE_BLUE_MARKER} from "./VitaLensEmergencyScreen"
import type {CardsView,CardAction} from "./Core/CardPresentation"
import type {EncounterEvent} from "./Core/EncounterTypes"
import {box,cm,hex,label,panel,flexColumn,flexRow,flexChild,text,button,setControl,setText,obj,COLOR,UiButton} from "./VitaLensSharedUI"

// The pointer is a square turned 45 degrees; half its diagonal is the pointer height.
const PIN_TIP=BED_PIN.pointer*Math.SQRT2

@component
export class VitaLensRoundUI extends BaseScriptComponent {
 @input presenterMode:boolean=false
 @input reducedMotion:boolean=false
 private patientKey=""
 private motionRoot:SceneObject|null=null
 private motionElapsed=1
 private motionDuration=0.24
 private transitionSurface=""

 private readonly intent=new Event<EncounterEvent>()
 get onIntent():PublicApi<EncounterEvent>{return this.intent.publicApi()}
 private card:SceneObject|null=null
 private presenter:SceneObject|null=null
 private key=""
 private vitalValues:Text[]=[]
 private timer:Text|null=null
 private controls:{button:UiButton;action:CardAction}[]=[]
 private presenterKey=""
 private presenterControls:{button:UiButton;action:CardAction}[]=[]
 private readonly presenterCache=new Map<string,{root:SceneObject;controls:{button:UiButton;action:CardAction}[]}>()
 private readonly cache=new Map<string,{root:SceneObject;controls:{button:UiButton;action:CardAction}[];values:Text[];timer:Text|null;subtitle:Text|null;content:SceneObject}>()
 private subtitle:Text|null=null
 private subtitleText=""
 private marker:SceneObject|null=null
 private markerStyle:BedMarkerStyle|null=null
 private markerText:Text|null=null
 private markerFills:RoundedRectangle[]=[]
 private markerLabels:Text[]=[]
 private ready=false
 private retire(root:SceneObject):void {
  root.enabled=false
  const event=this.createEvent("DelayedCallbackEvent")
  event.bind(()=>{root.destroy();event.enabled=false})
  event.reset(2)
 }
 private boundCache():void {
  while(this.cache.size>12){const k=Array.from(this.cache.keys()).find(k=>k!==this.key);if(k===undefined)break;const old=this.cache.get(k);this.cache.delete(k);if(old)this.retire(old.root)}
  while(this.presenterCache.size>8){const k=Array.from(this.presenterCache.keys()).find(k=>k!==this.presenterKey);if(k===undefined)break;const old=this.presenterCache.get(k);this.presenterCache.delete(k);if(old)this.retire(old.root)}
 }
 onAwake():void {
  this.sceneObject.createComponent("Component.Canvas")
  this.createEvent("OnStartEvent").bind(()=>{this.ready=true})
  this.createEvent("UpdateEvent").bind(()=>{
   if(!this.motionRoot || this.motionElapsed>=this.motionDuration)return
   this.motionElapsed+=getDeltaTime()
   const f=this.reducedMotion?1:Math.min(1,this.motionElapsed/this.motionDuration)
   this.motionRoot.getTransform().setLocalPosition(new vec3(0,0.25*(1-f)*(1-f),0.6))
  })
 }
 render(v:CardsView):void {
  if(!this.ready)return
  if(this.patientKey!==v.patientKey || !v.visible){
   this.patientKey=v.patientKey;this.key="";this.motionRoot=null
   for(const c of this.cache.values())this.retire(c.root)
   this.cache.clear();this.card=null
  }
  this.sceneObject.enabled=v.visible
  if(!v.visible)return
  const key=JSON.stringify({...v,vitals:v.vitals.map(x=>({...x,display:""})),timer:""})
  if(key!==this.key){
   const surface=v.patientKey+":"+v.surface
   this.motionDuration=this.transitionSurface.split(":")[0]===v.patientKey?0.16:0.24
   this.key=key;this.build(v)
   if(surface!==this.transitionSurface){this.motionElapsed=0;this.transitionSurface=surface}
  }
  if(this.card)this.card.enabled=!v.minimised
  this.subtitleText=v.subtitle
  this.vitalValues.forEach((t,i)=>setText(t,v.vitals[i]?.display??""))
  if(this.timer)setText(this.timer,v.emergency?v.timer+ (v.contact?" · "+v.contact:""):v.status)
  if(this.presenterMode)this.renderPresenter(v)
  else if(this.presenter)this.presenter.enabled=false
  for(const x of [...this.controls,...this.presenterControls])setControl(x.button,x.action.enabled)
  for(const tab of v.tabs){const c=this.controls.find(c=>c.action.name===tab.name);if(c?.button.label)setText(c.button.label,tab.label,tab.selected?COLOR.core:COLOR.inkSoft)}
  this.boundCache()
 }
 /** Shows or hides the clinical card only; the presenter controls stay. */
 setCardShown(on:boolean):void {if(this.card)this.card.enabled=on}
 private tint(root:SceneObject):void {
  const p=root.getComponent(BackPlate.getTypeName()) as BackPlate
  p.style="simple"
  p.onInitialized.add(()=>{
   const rr=root.getComponent(RoundedRectangle.getTypeName()) as RoundedRectangle
   if(rr){rr.gradient=false;rr.backgroundColor=new vec4(32/255,38/255,42/255,1)}
  })
 }
 private actionRow(parent:SceneObject,actions:CardAction[],w:number,presenter=false):void {
  const gap=2,bw=(w-gap)/2
  for(let i=0;i<actions.length;i+=2){
   const row=flexRow(parent,w,5,{gap})
   actions.slice(i,i+2).forEach(a=>{
    const b=button(row,a.name,a.label,actions.length===1?w:bw,5,()=>this.intent.invoke(a.event))
    ;(presenter?this.presenterControls:this.controls).push({button:b,action:a});setControl(b,a.enabled)
   })
  }
 }
 private build(v:CardsView):void {
  if(this.card){this.card.enabled=false;for(const c of this.controls)setControl(c.button,false)}
  const cached=this.cache.get(this.key)
  if(cached){this.card=cached.root;this.card.enabled=true;this.controls=[...cached.controls];this.vitalValues=cached.values;this.timer=cached.timer;this.subtitle=cached.subtitle;this.motionRoot=cached.content;return}
  this.controls=[];this.vitalValues=[];this.timer=null
  if(v.travel){this.buildTravel(v);return}
  const w=v.travel?24:32,inner=w-2.4,header=v.travel?4.8:5.5
  const actions=v.actions.filter(a=>v.tabs.length===0 || !["BtnCarePlan","BtnOverview","BtnCardsPrivacy"].includes(a.name))
  const footer=Math.ceil(actions.length/2)*5.6+0.8
  const tabHeight=v.tabs.length?5.1:0
  const height=v.travel?20:38,body=Math.max(3,height-header-footer-tabHeight-2.6)
  const p=panel(this.sceneObject,v.travel?"TravelDashboard":"ClinicalCard",w,height,vec3.zero(),{gap:0.5,padX:1.2,padY:0.8})
  this.card=p.root;this.tint(p.root);this.motionRoot=p.column
  const head=flexColumn(p.column,inner,header,{gap:0.2})
  text(head,v.title,"Title",inner,v.travel?2.3:2.6,{name:"CardsPatientName",color:v.emergency?COLOR.emergency:COLOR.ink})
  this.subtitle=text(head,v.subtitle,"Label",inner,v.travel?2:1.4,{name:"CardsPatientContext",color:COLOR.inkSoft})
  if(v.vitals.length && !v.travel)text(head,v.emergency?"HR / SpO₂: sample playback · BP 09:00":"Observations · sample chart 09:00","Label",inner,1.3,{name:"ObservationTime",color:COLOR.inkSoft})
  if(v.tabs.length){
   const row=flexRow(p.column,inner,4.5,{gap:2})
   for(const tab of v.tabs){
    const b=button(row,tab.name,tab.label,(inner-4)/3,4.5,()=>this.intent.invoke(tab.event))
    if(b.label)setText(b.label,tab.label,tab.selected?COLOR.core:COLOR.inkSoft)
    this.controls.push({button:b,action:{...tab,enabled:true}})
   }
  }
  const slot=flexChild(p.column,inner,body)
  const sw=obj(slot,"CardsScrollViewport")
  const scroll=sw.createComponent(ScrollWindow.getTypeName()) as ScrollWindow
  scroll.windowSize=new vec2(inner,body);scroll.horizontal=false;scroll.vertical=true
  const riskRows=v.rows.filter(r=>r.kind==="risk"),otherRows=v.rows.filter(r=>r.kind!=="risk")
  const rowHeights=otherRows.map(r=>v.surface==="overview"?Math.max(1.8,Math.ceil((r.label.length+r.value.length)/38)*1.5):v.travel?1.6:Math.max(2.8,Math.ceil((r.label.length+r.value.length)/48)*1.6+0.8))
  const riskHeight=riskRows.length?(v.travel?2.8:4):0
  const vitalHeight=v.vitals.length?Math.ceil(v.vitals.length/3)*(v.travel?3.7:4.2):0
  const contentH=v.surface==="overview"?body:Math.max(body,riskHeight+rowHeights.reduce((a,b)=>a+b,0)+vitalHeight+5+(v.rows.length+3)*0.4)
  scroll.scrollDimensions=new vec2(inner,contentH)
  const content=flexColumn(sw,inner,contentH,{gap:0.4})
  content.getTransform().setLocalPosition(new vec3(0,(body-contentH)/2,0.05))
  if(riskRows.length){const row=flexRow(content,inner,riskHeight,{gap:1});riskRows.forEach(r=>text(row,r.label+"\n"+r.value,"Body",(inner-1)/2,riskHeight,{name:"Risk"+r.label,color:COLOR.caution}))}
  const split=v.emergency?otherRows.length:Math.min(2,otherRows.length)
  const drawRow=(i:number)=>{const r=otherRows[i];text(content,v.travel?r.value:v.surface==="overview"?r.label+": "+r.value:r.label+"\n"+r.value,"Label",inner,rowHeights[i],{name:"CardRow"+i})}
  for(let i=0;i<split;i++)drawRow(i)
  for(let i=0;i<v.vitals.length;i+=3){
   const row=flexRow(content,inner,v.travel?3.7:4.2,{gap:0.7}),cw=(inner-1.4)/3
   v.vitals.slice(i,i+3).forEach((x,j)=>{
    const cell=flexColumn(row,cw,v.travel?3.7:4.2,{gap:0.1})
    text(cell,x.label,"Label",cw,1.3,{name:"MetricLabel"+(i+j),color:COLOR.inkSoft})
    this.vitalValues.push(text(cell,x.display,"Title",cw,1.8,{name:"MetricValue"+(i+j)}))
    text(cell,x.unit,"Label",cw,1.1,{name:"MetricUnit"+(i+j),color:COLOR.inkSoft})
   })
  }
  for(let i=split;i<otherRows.length;i++)drawRow(i)
  if(v.surface!=="overview")text(content,v.travel?"Sample playback · BP chart 09:00":v.source,"Label",inner,1.3,{name:"CardsSource",color:COLOR.inkSoft})
  this.timer=v.surface==="overview"?null:text(content,v.status,"Label",inner,1.4,{name:"CardsStatus",color:v.emergency?COLOR.emergency:COLOR.inkSoft})
  scroll.initialize()
  const foot=flexColumn(p.column,inner,footer,{gap:0.6})
  this.actionRow(foot,actions,inner)
  this.cache.set(this.key,{root:this.card,controls:[...this.controls],values:this.vitalValues,timer:this.timer,subtitle:this.subtitle,content:p.column})
 }
 private buildTravel(v:CardsView):void {
  const p=panel(this.sceneObject,"TravelDashboard",24,20,vec3.zero(),{gap:0.2,padX:0.7,padY:0.4})
  this.card=p.root;this.tint(p.root);this.motionRoot=p.column
  const w=22.6
  text(p.column,v.title,"Title",w,2.2,{name:"CardsPatientName",color:COLOR.emergency})
  this.subtitle=text(p.column,"CODE BLUE · Bed 3 · 78 · Full code","Label",w,1.4,{name:"CardsPatientContext"})
  const risks=flexRow(p.column,w,2.6,{gap:2})
  for(const r of v.rows.filter(r=>r.kind==="risk"))text(risks,r.label+"\n"+r.value,"Label",(w-2)/2,2.6,{color:COLOR.caution})
  text(p.column,v.rows.find(r=>r.kind!=="risk")?.value??"Unknown","Label",w,1.4)
  const row=flexRow(p.column,w,3.6,{gap:0.7}),cw=(w-1.4)/3
  v.vitals.forEach((x,i)=>{
   const c=flexColumn(row,cw,3.6,{gap:0.1})
   text(c,x.label,"Label",cw,1,{name:"MetricLabel"+i})
   this.vitalValues.push(text(c,x.display,"Title",cw,1.6,{name:"MetricValue"+i}))
   text(c,x.unit,"Label",cw,0.8)
  })
  text(p.column,"Samples · not live · BP chart 09:00","Label",w,1.2,{name:"CardsSource"})
  const foot=flexRow(p.column,w,5,{gap:2})
  const travelActions=[...v.actions,...v.presenter].filter(a=>["BtnCallDoctor","BtnCardsPrivacy","BtnDoctorBriefing"].includes(a.name))
  for(const a of travelActions){
   const label=a.name==="BtnCallDoctor"?(v.contact?"Called":"Call"):a.name==="BtnDoctorBriefing"?"Brief":"Privacy"
   const b=button(foot,a.name,label,(w-4)/3,5,()=>this.intent.invoke(a.event));this.controls.push({button:b,action:a});setControl(b,a.enabled)
  }
  this.timer=null
  this.cache.set(this.key,{root:p.root,controls:[...this.controls],values:this.vitalValues,timer:null,subtitle:this.subtitle,content:p.column})
 }
 setDestinationOpacity(a:number):void {
  for(const r of this.markerFills){const c=r.backgroundColor;r.backgroundColor=new vec4(c.x,c.y,c.z,a)}
  for(const t of this.markerLabels){const c=t.textFill.color;t.textFill.color=new vec4(c.x,c.y,c.z,a)}
 }
 /** The pin, its pointer tip at `tip`, facing the camera and a constant size in view. */
 setDestination(tip:vec3|null,camera:vec3=vec3.zero(),bearing:number=0,style:BedMarkerStyle=CODE_BLUE_MARKER):void {
  if(!this.ready)return
  if(!tip){if(this.marker)this.marker.enabled=false;return}
  if(!this.marker){
   // bed_pin in s3-em-travel at UI_SCALE. The bed outline needs the ward scene.
   this.marker=obj(this.sceneObject,"EmergencyBedMarker")
   const f=obj(this.marker,"Bubble",new vec3(-BED_PIN.w/2,BED_PIN.pill+BED_PIN.pointer,0))
   const pointer=box(f,(BED_PIN.w-PIN_TIP)/2,BED_PIN.pill-PIN_TIP/2,PIN_TIP,PIN_TIP,style.fill)
   pointer.so.getTransform().setLocalRotation(quat.fromEulerAngles(0,0,Math.PI/4))
   const pill=box(f,0,0,BED_PIN.w,BED_PIN.pill,style.fill,BED_PIN.radius)
   this.markerText=label(f,0,0,BED_PIN.w,BED_PIN.pill/2,"",1.6,700,style.ink,{align:"center",name:"EmergencyDestination"})
   const sub=label(f,0,BED_PIN.pill/2,BED_PIN.w,BED_PIN.pill/2,style.sub,1.4,700,style.ink,{align:"center"})
   this.markerFills=[pointer.rr,pill.rr];this.markerLabels=[this.markerText,sub]
  }
  this.marker.enabled=true
  if(style!==this.markerStyle){
   this.markerStyle=style
   for(const r of this.markerFills)r.backgroundColor=style.fill
   setText(this.markerLabels[0],style.title,style.ink)
   setText(this.markerLabels[1],style.sub,style.ink)
  }
  const m=this.marker.getTransform(),d=tip.distance(camera)/110
  m.setWorldPosition(tip);m.setWorldScale(new vec3(d,d,d))
  m.setWorldRotation(quat.fromEulerAngles(0,Math.atan2(camera.x-tip.x,camera.z-tip.z),0))
  const arrow=Math.abs(bearing)<0.35?"↑":bearing>0?"→":"←"
  if(style===CODE_BLUE_MARKER&&this.subtitle)setText(this.subtitle,this.subtitleText+" · "+arrow)
 }
 private renderPresenter(v:CardsView):void {
  const key=JSON.stringify(v.presenter)
  if(key===this.presenterKey)return
  this.presenterKey=key
  if(this.presenter)this.presenter.enabled=false
  const cached=this.presenterCache.get(key)
  if(cached){this.presenter=cached.root;this.presenterControls=[...cached.controls];cached.root.enabled=true;return}
  this.presenterControls=[]
  const p=panel(this.sceneObject,"PresenterControls",38,Math.ceil(v.presenter.length/2)*5.6+4,new vec3(-48,0,0),{gap:0.5})
  this.presenter=p.root;this.tint(p.root)
  text(p.column,"DEMO PRESENTER · not nurse controls","Label",35.6,2,{color:COLOR.system})
  this.actionRow(p.column,v.presenter,35.6,true)
  this.presenterCache.set(key,{root:p.root,controls:[...this.presenterControls]})
 }
}
