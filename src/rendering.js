// Phase 11: SpriteRenderer — interprets visual recipes (shapes + animations)
// and draws them on the canvas with skeletal joint transforms.
const JOINT_ANGLES={ // channel name → max rotation in degrees (for rotate mode)
  arm_raise:90, arm_swing:60, leg_swing:30, bow_draw:15,
  head_tilt:20, bob:8, staff_raise:70, rot:90, tail_wag:25,
  wing_flap:30, jaw_open:20, recoil:8, lunge:12,
  squash:0.2, stretch:0.2, breathe:0.05, wobble:0.1,
};
// Phase 24c: joint config — mode + axis + range per channel.
const JOINT_CONFIG={
  arm_raise:{mode:"rotate"}, arm_swing:{mode:"rotate"}, leg_swing:{mode:"rotate"},
  bow_draw:{mode:"translate",axis:"x",range:-5}, head_tilt:{mode:"rotate"}, bob:{mode:"translate",axis:"y",range:2},
  staff_raise:{mode:"rotate"}, rot:{mode:"rotate"}, tail_wag:{mode:"rotate"},
  wing_flap:{mode:"translate",axis:"y",range:6}, jaw_open:{mode:"translate",axis:"y",range:4},
  recoil:{mode:"translate",axis:"y",range:5}, lunge:{mode:"translate",axis:"x",range:4},
  squash:{mode:"scale",axis:"y",range:0.2}, stretch:{mode:"scale",axis:"x",range:0.2},
  breathe:{mode:"scale",axis:"both",range:0.05}, wobble:{mode:"scale",axis:"x",range:0.1},
};
const ANIM_DURATIONS={idle:2.0,move:0.6,attack:0.4,death:0.5};

// PERF-R12: Sprite pre-rendering system.
// Pre-renders each sprite (body shapes + gradients + joints) to an offscreen canvas,
// keyed by (recipeId, state, frameIndex, team). Then drawImage per frame instead of
// re-drawing all shapes with gradients. 10-100x faster than per-frame path rendering.
// Face/eyes are drawn dynamically on top (they track targets).
const SPRITE_CACHE_FRAMES=8; // frames per animation cycle
const SPRITE_CACHE_PAD=4;     // padding around sprite bounds
// Origin position within cache canvas: 70% from top leaves 30% below for legs/feet.
// Sprite shapes extend from y≈-30 (head) to y≈+15 (legs) unscaled; the origin
// (unit feet) must be high enough to fit the lower extent without clipping.
const SPRITE_ORIGIN_FRAC=0.7;
const _spriteCache=new Map(); // key → offscreen canvas
// PERF-R12: hoist faced plans Set (avoid per-drawFace array allocation + includes scan).
const _facedPlans=new Set(["humanoid","undead","demon","beast-man","ghost","flying","monopod","angel","wraith","gargoyle","spider","kraken","wyvern","treant"]);

function _getRecipeId(u){
  // Use the unit's name as a proxy for recipe identity (each forged unit has a unique name).
  // For base units, the name maps to a fixed recipe. This is a heuristic but works because
  // recipe shapes are determined at unit creation and don't change.
  if(u._spriteCacheId)return u._spriteCacheId;
  // Build a key from recipe shape count + colors + body plan + weapon.
  const r=u.recipe;
  if(!r)return null;
  const shapes=r.shapes||[];
  let key=(r.bodyPlan||"")+"|"+(r.skin||"")+"|"+shapes.length;
  for(let i=0;i<shapes.length;i++){
    const s=shapes[i];
    key+="|"+s.t+":"+(s.c||"")+":"+(s.c2||"")+":"+(s.r||s.w||"")+":"+(s.glow||0)+":"+(s.outline||0);
  }
  // Include weapon + accessories
  if(r.weapon)key+="|w:"+r.weapon;
  if(r.accessories)key+="|a:"+r.accessories.length;
  // Include color palette
  key+="|c:"+(u.c||"")+":"+(u.accent||"");
  u._spriteCacheId=key;
  return key;
}

function _getSpriteCacheKey(u,state,frameIdx){
  // PERF-R12: cache key prefix on unit (avoids string concat per call).
  // Prefix = recipeId + "|z" + zRounded + "|" — only changes when z changes.
  // v2: origin moved to 70% + bob removed from cache (format change).
  const zR=Math.round((u.z||10)*2)/2;
  if(u._spriteKeyZ!==zR){
    u._spriteKeyZ=zR;
    u._spriteKeyPrefix=_getRecipeId(u)+"|z"+zR+"|v2|";
  }
  return u._spriteKeyPrefix+state+"|"+frameIdx;
}

function _renderSpriteToCache(u,state,frameIdx){
  const recipe=u.recipe;
  if(!recipe)return null;
  const dur=ANIM_DURATIONS[state]||2;
  const t=frameIdx/SPRITE_CACHE_FRAMES;
  const anims=recipe.animations||{};
  const keyframes=anims[state]||anims.idle||[{t:0}];
  const channels=SpriteRenderer.interpolate(keyframes,t);
  const rm=G.save?.settings?.reducedMotion;
  const bobY=rm?0:(channels.bob?Math.sin(t*Math.PI*2)*2:0);
  const alpha=channels.alpha!==undefined?channels.alpha:1;
  const rot=rm?0:(channels.rot||0);

  // Sprite dimensions: scale factor is (z/10)*1.8, sprite is ~52px wide, ~65px tall at z=10.
  const spriteScale=Math.max(0.1,(u.z||10)/10*1.8);
  const spriteW=Math.max(1,Math.ceil(60*spriteScale)+SPRITE_CACHE_PAD*2);
  const spriteH=Math.max(1,Math.ceil(70*spriteScale)+SPRITE_CACHE_PAD*2);

  // Create offscreen canvas
  const oc=document.createElement("canvas");
  oc.width=spriteW;oc.height=spriteH;
  const sc=oc.getContext("2d");
  // Origin at 70% from top — leaves room for legs/feet below the origin
  // (shapes extend to y≈+15 unscaled, scaled by 1.8 = +27px below origin).
  const cx=spriteW/2, cy=spriteH*SPRITE_ORIGIN_FRAC;

  // Set up the same transform stack as SpriteRenderer.draw, but centered on our canvas.
  sc.save();
  sc.globalAlpha=alpha;
  sc.translate(cx,cy);
  sc.scale(spriteScale,spriteScale);
  sc.translate(-cx,-cy);
  // Enemy flip — bake into cache so we don't need to flip at draw time.
  if(u.team==="enemy"){sc.translate(cx,cy);sc.scale(-1,1);sc.translate(-cx,-cy);}
  if(rot){sc.translate(cx,cy);sc.rotate(rot*Math.PI/180);sc.translate(-cx,-cy);}

  // Temporarily set u's position to the canvas origin for shape rendering.
  // Bob is NOT baked into the cache — it's applied at draw time (smoother + avoids
  // double-bob since the draw path also adds bobY to dy).
  const saveX=u.x, saveY=u.y, saveZ=u.z;
  u.x=cx; u.y=cy; u.z=u.z||10;

  // Draw ground decal — team-colored base ring for friend/foe identification.
  if(state!=="death"){
    sc.save();
    sc.globalAlpha=0.3*alpha;
    sc.fillStyle=TEAM_COLORS[u.team]||"#888";
    sc.beginPath();
    sc.ellipse(cx,cy+(u.z||10)*0.85,(u.z||10)*1.1,(u.z||10)*0.35,0,0,Math.PI*2);
    sc.fill();
    // Team-colored stroke ring — clear visual team indicator at unit's base.
    sc.globalAlpha=0.6*alpha;
    sc.strokeStyle=TEAM_COLORS[u.team]||"#888";
    sc.lineWidth=1.5;
    sc.beginPath();
    sc.ellipse(cx,cy+(u.z||10)*0.85,(u.z||10)*1.1,(u.z||10)*0.35,0,0,Math.PI*2);
    sc.stroke();
    sc.restore();
  }
  // Drop shadow
  if(!recipe.noShadow&&state!=="death"){
    sc.save();
    sc.globalAlpha=0.25*alpha;
    sc.fillStyle="#000";
    sc.beginPath();
    sc.ellipse(cx,cy+(u.z||10)*0.8,(u.z||10)*0.9,(u.z||10)*0.3,0,0,Math.PI*2);
    sc.fill();
    sc.restore();
  }
  // Draw all shapes
  for(const shape of(recipe.shapes||[])){
    SpriteRenderer.drawShape(sc,shape,rm?{}:channels,u);
  }
  // Silhouette outline (only if few shapes — skip for performance)
  // Intentionally omitted in cached version — the per-shape outlines are sufficient.

  // Restore u's position
  u.x=saveX; u.y=saveY; u.z=saveZ;
  sc.restore();

  return oc;
}

function _getCachedSprite(u,state,frameIdx){
  const key=_getSpriteCacheKey(u,state,frameIdx);
  let cached=_spriteCache.get(key);
  if(!cached){
    cached=_renderSpriteToCache(u,state,frameIdx);
    if(cached)_spriteCache.set(key,cached);
  }
  return cached;
}

// Clear sprite cache (call on battle start to free memory + handle new units).
function _clearSpriteCache(){
  _spriteCache.clear();
}

const SpriteRenderer={
  // Linear interpolation between keyframes for numeric channels.
  // Phase 24g: supports easing per segment via ease field on keyframe.
  interpolate(keyframes,t){
    if(!keyframes||!keyframes.length)return{};
    if(keyframes.length===1)return{...keyframes[0]};
    // Clamp t to [0,1] and find the surrounding keyframes.
    t=Math.max(0,Math.min(1,t));
    let prev=keyframes[0],next=keyframes[keyframes.length-1];
    for(let i=0;i<keyframes.length-1;i++){
      if(t>=keyframes[i].t&&t<=keyframes[i+1].t){
        prev=keyframes[i];next=keyframes[i+1];break;
      }
    }
    const span=next.t-prev.t||1;
    let f=(t-prev.t)/span;
    // Phase 24g: easing curves.
    const ease=next.ease;
    if(ease==="easeOut")f=1-(1-f)*(1-f);
    else if(ease==="easeIn")f=f*f;
    else if(ease==="easeInOut")f=f<0.5?2*f*f:1-((-2*f+2)**2)/2;
    const out={};
    for(let ch in next){
      if(ch==="t"||ch==="ease")continue;
      const pv=prev[ch]||0,nv=next[ch]||0;
      out[ch]=typeof nv==="number"?pv+(nv-pv)*f:nv;
    }
    return out;
  },

  // Draw a single shape with optional parent + own joint transforms.
  // D5: parentJoint allows weapons to inherit arm_raise, attached to the hand.
  drawShape(c,shape,channels,u){
    this._drawOne(c,shape,channels,u,false);
  },

  // Stroke a shape outline only (for silhouette outline pass).
  _strokeShape(c,shape,channels,u){
    this._drawOne(c,shape,channels,u,true);
  },

  // Unified shape draw/stroke with parentJoint + own joint support.
  // PERF-R12: reusable lightweight uLocal buffer (only x,y needed by drawShapeRaw/_applyJoint).
  _uLocalBuf:{x:0,y:0},
  _drawOne(c,shape,channels,u,isStroke){
    // PERF-R12: avoid .bind(this) per call (allocates function) — call directly.
    const self=this;
    const raw=isStroke?self._strokeShapeRaw:self._drawShapeRaw;
    const parent=shape.parentJoint;
    const joint=shape.joint;
    if(!parent&&!joint){raw.call(self,c,shape,u);return;}
    // When parented, the weapon is drawn at the unit's position + gripOffset (the hand)
    // in the parent-rotated frame. The parent pivot is the shoulder.
    // PERF-R12: only x,y are needed downstream — avoid {...u} spread (copies ~30 props).
    let uLocal=u;
    if(parent){
      uLocal=self._uLocalBuf;
      uLocal.x=u.x+(shape.gripOffset?.x||0);
      uLocal.y=u.y+(shape.gripOffset?.y||0);
    }
    c.save();
    if(parent) self._applyJoint(c,shape,channels,u,parent,shape.parentPivot);
    if(joint){
      c.save();
      self._applyJoint(c,shape,channels,uLocal,joint,null);
      raw.call(self,c,shape,uLocal);
      c.restore();
    }else{
      raw.call(self,c,shape,uLocal);
    }
    c.restore();
  },

  // Apply a single joint transform. pivotOverride (for parentJoint) or shape's
  // own pivot (if null). Does NOT save/restore — caller handles that.
  _applyJoint(c,shape,channels,u,jointName,pivotOverride){
    const chVal=channels[jointName]||0;
    const cfg=JOINT_CONFIG[jointName]||{mode:"rotate"};
    const mode=shape.jointMode||cfg.mode;
    const px=pivotOverride?pivotOverride.x:(shape.t==="rect"?shape.x+shape.w/2:(shape.cx||shape.x||0));
    const py=pivotOverride?pivotOverride.y:(shape.t==="rect"?shape.y:(shape.cy||shape.y||0));
    if(mode==="rotate"){
      const maxAngle=(JOINT_ANGLES[jointName]||30)*Math.PI/180;
      c.translate(u.x+px,u.y+py);
      c.rotate(chVal*maxAngle);
      c.translate(-(u.x+px),-(u.y+py));
    }else if(mode==="translate"){
      const range=shape.jointRange||cfg.range||5;
      const axis=shape.jointAxis||cfg.axis||"y";
      const offset=chVal*range;
      if(axis==="x")c.translate(offset,0);
      else if(axis==="y")c.translate(0,offset);
      else c.translate(offset*0.7,offset*0.3);
    }else if(mode==="scale"){
      const range=shape.jointRange||cfg.range||0.1;
      const axis=shape.jointAxis||cfg.axis||"both";
      const sx=axis==="x"||axis==="both"?1+chVal*range:1;
      const sy=axis==="y"||axis==="both"?1+chVal*range:1;
      const cx=shape.t==="rect"?shape.x+shape.w/2:(shape.cx||shape.x||0);
      const cy=shape.t==="rect"?shape.y+shape.h/2:(shape.cy||shape.y||0);
      c.translate(u.x+cx,u.y+cy);
      c.scale(sx,sy);
      c.translate(-(u.x+cx),-(u.y+cy));
    }
  },

  // Stroke a shape without joint transform.
  _strokeShapeRaw(c,shape,u){
    const ox=u.x,oy=u.y;
    switch(shape.t){
      case "circle":
        c.beginPath();c.arc(ox+shape.cx,oy+shape.cy,shape.r,0,Math.PI*2);c.stroke();break;
      case "ellipse":
        c.beginPath();c.ellipse(ox+shape.cx,oy+shape.cy,shape.rx,shape.ry,0,0,Math.PI*2);c.stroke();break;
      case "rect":
        c.strokeRect(ox+shape.x,oy+shape.y,shape.w,shape.h);break;
      case "polygon":
        if(!shape.pts||!shape.pts.length)break;
        c.beginPath();
        for(let i=0;i<shape.pts.length;i++){
          const px=ox+shape.pts[i][0],py=oy+shape.pts[i][1];
          if(i===0)c.moveTo(px,py);else c.lineTo(px,py);
        }
        c.closePath();c.stroke();break;
      case "arc":
        c.beginPath();c.arc(ox+shape.cx,oy+shape.cy,shape.r,shape.start,shape.end);c.stroke();break;
      default:break;
    }
  },
  _drawShapeRaw(c,shape,u){
    const ox=u.x,oy=u.y;
    // PERF-R11: avoid per-frame object spread ({...shape}) — use local vars instead.
    // Phase 32: apply colorblind filter to shape color.
    let sc=shape.c,sc2=shape.c2,soc=shape.oc,soutline=shape.outline;
    if(G.save?.settings?.colorblind&&G.save.settings.colorblind!=="off"){
      if(sc)sc=G.applyColorblind(sc);
      if(sc2)sc2=G.applyColorblind(sc2);
    }
    // Sanitize colors to prevent malformed hex from crashing gradient rendering.
    if(sc)sc=sanitizeHex(sc);
    if(sc2)sc2=sanitizeHex(sc2);
    if(soc)soc=sanitizeHex(soc);
    // Phase 32: high contrast — thicker outlines.
    if(G.save?.settings?.highContrast&&soutline)soutline=soutline+1;
    // Phase 24b: per-shape alpha.
    const prevAlpha=c.globalAlpha;
    if(shape.alpha!==undefined)c.globalAlpha=shape.alpha;
    // Phase 24b: gradient fill support + D1: auto gradient shading for flat colors.
    // PERF-R11: use cached color vars (sc, sc2, soc) instead of re-reading shape.c.
    let g;
    if(shape.fill==="gradient"&&sc2){
      if(shape.t==="circle"){
        g=c.createRadialGradient(ox+shape.cx-(shape.r||4)*0.3,oy+shape.cy-(shape.r||4)*0.3,1,
          ox+shape.cx,oy+shape.cy,shape.r||4);
      }else{
        const x=shape.x!==undefined?shape.x:(shape.cx||0)-10;
        const y=shape.y!==undefined?shape.y:(shape.cy||0)-10;
        const w=shape.w!==undefined?shape.w:20;
        const h=shape.h!==undefined?shape.h:20;
        g=c.createLinearGradient(ox+x,oy+y,ox+x+w,oy+y+h);
      }
      g.addColorStop(0,lighten(sc||"#888",0.1));
      g.addColorStop(1,sc2);
      c.fillStyle=g;
    }else if(sc&&shape.fill!=="gradient"&&!shape.glow){
      // D1: auto gradient — lighter top, darker bottom for depth.
      // V2: increased contrast (0.18 vs 0.12) for more vibrant cartoon look.
      const base=sc;
      if(shape.t==="circle"||shape.t==="ellipse"){
        const r=shape.r||shape.rx||4;
        g=c.createRadialGradient(ox+(shape.cx||0)-r*0.3,oy+(shape.cy||0)-r*0.3,1,
          ox+(shape.cx||0),oy+(shape.cy||0),r);
        g.addColorStop(0,lighten(base,0.18));
        g.addColorStop(1,darken(base,0.15));
        c.fillStyle=g;
      }else{
        const x=shape.x!==undefined?shape.x:(shape.cx||0)-10;
        const y=shape.y!==undefined?shape.y:(shape.cy||0)-10;
        const w=shape.w!==undefined?shape.w:20;
        const h=shape.h!==undefined?shape.h:20;
        g=c.createLinearGradient(ox+x,oy+y,ox+x,oy+y+h);
        g.addColorStop(0,lighten(base,0.18));
        g.addColorStop(1,darken(base,0.15));
        c.fillStyle=g;
      }
    }else{
      c.fillStyle=sc||"#888";
    }
    c.strokeStyle=soc||sc||"#888";
    c.lineWidth=soutline||shape.w||1;
    // PERF-R11: skip shadowBlur when many units on screen (expensive GPU op).
    if(shape.glow&&Battle.units.length<=10){c.shadowBlur=shape.glow;c.shadowColor=sc||"#fff";}
    const hasOutline=!!soutline;
    const strokeBlack=()=>{if(!hasOutline){c.strokeStyle="#000";c.lineWidth=1;c.stroke();}};
    switch(shape.t){
      case "circle":
        c.beginPath();c.arc(ox+shape.cx,oy+shape.cy,shape.r,0,Math.PI*2);c.fill();
        if(soutline)c.stroke();else strokeBlack();
        break;
      case "rect":
        c.fillRect(ox+shape.x,oy+shape.y,shape.w,shape.h);
        if(soutline)c.strokeRect(ox+shape.x,oy+shape.y,shape.w,shape.h);else{c.strokeStyle="#000";c.lineWidth=1;c.strokeRect(ox+shape.x,oy+shape.y,shape.w,shape.h);}
        break;
      case "line":
        c.beginPath();c.moveTo(ox+shape.x1,oy+shape.y1);c.lineTo(ox+shape.x2,oy+shape.y2);c.stroke();break;
      case "polygon":
        if(!shape.pts||!shape.pts.length)break;
        c.beginPath();
        for(let i=0;i<shape.pts.length;i++){
          const px=ox+shape.pts[i][0],py=oy+shape.pts[i][1];
          if(i===0)c.moveTo(px,py);else c.lineTo(px,py);
        }
        c.closePath();c.fill();
        if(soutline)c.stroke();else strokeBlack();
        break;
      case "arc":
        c.beginPath();c.arc(ox+shape.cx,oy+shape.cy,shape.r,shape.start,shape.end);c.stroke();break;
      case "ellipse":
        c.beginPath();c.ellipse(ox+shape.cx,oy+shape.cy,shape.rx,shape.ry,0,0,Math.PI*2);c.fill();
        if(soutline)c.stroke();else strokeBlack();
        break;
    }
    // Phase 24b: surface patterns (stripes, spots, scales, runes, cracks, circuit, tribal, stars, hexagons, marble).
    if(shape.pattern&&sc2){
      c.save();
      c.fillStyle=sc2;
      c.strokeStyle=sc2;
      c.globalAlpha=(shape.alpha!==undefined?shape.alpha:1)*0.5;
      if(shape.t==="rect"||shape.t==="circle"||shape.t==="polygon"||shape.t==="ellipse"){
        // Clip to shape bounds.
        if(shape.t==="rect"){
          c.beginPath();c.rect(ox+shape.x,oy+shape.y,shape.w,shape.h);c.clip();
          const spacing=4;
          if(shape.pattern==="circuit"){
            c.lineWidth=0.5;
            for(let px=ox+shape.x;px<ox+shape.x+shape.w;px+=spacing){
              c.beginPath();c.moveTo(px,oy+shape.y);c.lineTo(px,oy+shape.y+shape.h);c.stroke();
            }
            for(let py=oy+shape.y;py<oy+shape.y+shape.h;py+=spacing){
              c.beginPath();c.moveTo(ox+shape.x,py);c.lineTo(ox+shape.x+shape.w,py);c.stroke();
            }
          }else if(shape.pattern==="stars"){
            for(let i=0;i<5;i++){
              const sx=ox+shape.x+Math.random()*shape.w;
              const sy=oy+shape.y+Math.random()*shape.h;
              c.beginPath();c.arc(sx,sy,0.8,0,Math.PI*2);c.fill();
            }
          }else{
            for(let py=oy+shape.y;py<oy+shape.y+shape.h;py+=spacing){
              c.fillRect(ox+shape.x,py,shape.w,1.5);
            }
          }
        }else if(shape.t==="circle"){
          c.beginPath();c.arc(ox+shape.cx,oy+shape.cy,shape.r,0,Math.PI*2);c.clip();
          if(shape.pattern==="spots"){
            for(let i=0;i<4;i++){
              const a=i*Math.PI/2;
              c.beginPath();c.arc(ox+shape.cx+Math.cos(a)*shape.r*0.4,oy+shape.cy+Math.sin(a)*shape.r*0.4,1.5,0,Math.PI*2);c.fill();
            }
          }else if(shape.pattern==="scales"){
            for(let row=-2;row<=2;row++){
              for(let col=-2;col<=2;col++){
                const sx=ox+shape.cx+col*4+row%2*2;
                const sy=oy+shape.cy+row*3;
                if(Math.hypot(sx-ox-shape.cx,sy-oy-shape.cy)<shape.r){
                  c.beginPath();c.arc(sx,sy,2,0,Math.PI);c.stroke();
                }
              }
            }
          }else if(shape.pattern==="runes"){
            c.lineWidth=0.8;
            for(let i=0;i<3;i++){
              const a=i*Math.PI*2/3;
              const rx=ox+shape.cx+Math.cos(a)*shape.r*0.5;
              const ry=oy+shape.cy+Math.sin(a)*shape.r*0.5;
              c.beginPath();c.arc(rx,ry,2,0,Math.PI*2);c.stroke();
            }
          }else if(shape.pattern==="cracks"){
            c.lineWidth=0.8;
            for(let i=0;i<3;i++){
              const a=i*Math.PI*2/3+0.5;
              c.beginPath();c.moveTo(ox+shape.cx,oy+shape.cy);
              c.lineTo(ox+shape.cx+Math.cos(a)*shape.r,oy+shape.cy+Math.sin(a)*shape.r);
              c.stroke();
            }
          }else if(shape.pattern==="circuit"){
            c.lineWidth=0.5;
            for(let i=0;i<6;i++){
              const a=i*Math.PI/3;
              c.beginPath();c.moveTo(ox+shape.cx,oy+shape.cy);
              c.lineTo(ox+shape.cx+Math.cos(a)*shape.r,oy+shape.cy+Math.sin(a)*shape.r);
              c.stroke();
            }
          }else if(shape.pattern==="tribal"){
            c.lineWidth=1;
            c.beginPath();c.arc(ox+shape.cx,oy+shape.cy,shape.r*0.6,0,Math.PI*2);c.stroke();
            c.beginPath();c.arc(ox+shape.cx,oy+shape.cy,shape.r*0.3,0,Math.PI*2);c.stroke();
          }else if(shape.pattern==="stars"){
            for(let i=0;i<6;i++){
              const a=i*Math.PI/3;
              const sx=ox+shape.cx+Math.cos(a)*shape.r*0.5;
              const sy=oy+shape.cy+Math.sin(a)*shape.r*0.5;
              c.beginPath();c.arc(sx,sy,0.8,0,Math.PI*2);c.fill();
            }
          }else if(shape.pattern==="hexagons"){
            c.lineWidth=0.6;
            for(let row=-2;row<=2;row++){
              for(let col=-2;col<=2;col++){
                const hx=ox+shape.cx+col*5+row%2*2.5;
                const hy=oy+shape.cy+row*4;
                if(Math.hypot(hx-ox-shape.cx,hy-oy-shape.cy)<shape.r){
                  c.beginPath();
                  for(let i=0;i<6;i++){
                    const a=i*Math.PI/3;
                    const px=hx+Math.cos(a)*2;
                    const py=hy+Math.sin(a)*2;
                    if(i===0)c.moveTo(px,py);else c.lineTo(px,py);
                  }
                  c.closePath();c.stroke();
                }
              }
            }
          }else if(shape.pattern==="marble"){
            c.lineWidth=0.4;
            for(let i=0;i<4;i++){
              c.beginPath();
              c.moveTo(ox+shape.cx-shape.r,oy+shape.cy+Math.random()*shape.r*2-shape.r);
              c.bezierCurveTo(
                ox+shape.cx-shape.r/3,oy+shape.cy+Math.random()*shape.r*2-shape.r,
                ox+shape.cx+shape.r/3,oy+shape.cy+Math.random()*shape.r*2-shape.r,
                ox+shape.cx+shape.r,oy+shape.cy+Math.random()*shape.r*2-shape.r
              );
              c.stroke();
            }
          }else{
            for(let py=oy+shape.cy-shape.r;py<oy+shape.cy+shape.r;py+=3){
              c.fillRect(ox+shape.cx-shape.r,py,shape.r*2,1);
            }
          }
        }
      }
      c.restore();
    }
    if(shape.glow)c.shadowBlur=0;
    c.globalAlpha=prevAlpha;
  },

  // Main entry: draw a unit using its recipe, or fallback to role-coded shape.
  draw(c,u){
    if(!u.recipe){
      // Fallback: role-coded shape (Phase 19a).
      c.fillStyle=u.c;
      this._drawRoleShape(c,u);
      c.fill();
      return;
    }
    const recipe=u.recipe;
    const state=u.animState||"idle";
    const dur=ANIM_DURATIONS[state]||2;
    // Compute normalized time t (0-1) for the current animation state.
    let t;
    if(state==="death")t=Math.min(1,(u.deathT||0)/dur);
    else if(state==="attack")t=u.attackT>=0?u.attackT:0;
    else if(state==="move")t=(Battle.time/dur)%1;
    else t=(Battle.time/dur)%1;
    // Interpolate keyframes for the current state.
    const anims=recipe.animations||{};
    const keyframes=anims[state]||anims.idle||[{t:0}];
    // PERF-R12: fast path — only compute bob/alpha/rot when using cache (avoids full interpolate).
    // Phase 32: reduced motion — skip bob/squash/stretch/wobble channels.
    // PERF-R12: use per-frame cached values (avoid per-unit property access).
    const rm=SpriteRenderer._frameRM;
    const useCacheFast=state!=="death"&&!rm&&!(u.spawnT>0);
    let channels,bobY,alpha,rot;
    if(useCacheFast){
      // Fast path: only extract bob/alpha/rot from keyframes (no full object allocation).
      // Find surrounding keyframes.
      let prev=keyframes[0],next=keyframes[keyframes.length-1];
      if(keyframes.length>1){
        t=Math.max(0,Math.min(1,t));
        for(let i=0;i<keyframes.length-1;i++){
          if(t>=keyframes[i].t&&t<=keyframes[i+1].t){prev=keyframes[i];next=keyframes[i+1];break;}
        }
      }
      const span=next.t-prev.t||1;
      let f=(t-prev.t)/span;
      const ease=next.ease;
      if(ease==="easeOut")f=1-(1-f)*(1-f);
      else if(ease==="easeIn")f=f*f;
      else if(ease==="easeInOut")f=f<0.5?2*f*f:1-((-2*f+2)**2)/2;
      const bobCh=next.bob, alphaCh=next.alpha, rotCh=next.rot;
      const hasBob=bobCh!==undefined, hasAlpha=alphaCh!==undefined, hasRot=rotCh!==undefined;
      // bob is a truthy flag — amplitude is always 2 (matches original channels.bob?Math.sin(...)*2:0).
      bobY=rm?0:(hasBob?Math.sin(t*Math.PI*2)*2:0);
      alpha=hasAlpha?(prev.alpha||0)+(alphaCh-(prev.alpha||0))*f:1;
      rot=rm?0:(hasRot?(prev.rot||0)+(rotCh-(prev.rot||0))*f:0);
      channels=null; // will be recomputed on cache miss (rare)
    }else{
      channels=this.interpolate(keyframes,t);
      bobY=rm?0:(channels.bob?Math.sin(t*Math.PI*2)*2:0);
      alpha=channels.alpha!==undefined?channels.alpha:1;
      rot=rm?0:(channels.rot||0);
    }

    // PERF-R12: Use pre-rendered sprite cache when possible.
    // Skip cache for death state (continuous fade), reducedMotion (different channel set),
    // and spawn animation (changes u.z scale).
    // hitReact is now handled in cached path (just a position offset).
    const useCache=state!=="death"&&!rm&&!(u.spawnT>0);
    if(useCache){
      // PERF-R12: compute hitReact offset (applied to cached sprite position).
      let reactX=0,reactY=0;
      if(u.hitReact>0){
        const dir=u.hitReactDir||_zeroDir;
        reactX=dir.x*3*u.hitReact;
        reactY=dir.y*3*u.hitReact;
      }
      const frameIdx=Math.min(SPRITE_CACHE_FRAMES-1,Math.floor(t*SPRITE_CACHE_FRAMES));
      const cached=_getCachedSprite(u,state,frameIdx);
      if(cached&&cached.width>0&&cached.height>0){
        // PERF-R12: decrement hitReact only on cache hit (avoids double-decrement on miss).
        if(u.hitReact>0)u.hitReact-=0.015;
        // Draw the cached sprite image. Enemy flip + scale are baked into cache.
        const spriteScale=Math.max(0.1,(u.z||10)/10*1.8);
        const sw=cached.width, sh=cached.height;
        // Cached sprite's origin (unit feet) is at (sw/2, sh-PAD).
        // PERF-R12: round to integer pixels (avoids sub-pixel anti-aliasing overhead).
        // Apply hitReact offset to draw position.
        const dx=((u.x+reactX) - sw/2)|0;
        const dy=((u.y+reactY) - (sh*SPRITE_ORIGIN_FRAC) + bobY)|0;
        // Team-colored outline glow — subtle aura behind the unit for team ID.
        // Drawn before the sprite so it appears behind the body shapes.
        const oldAlpha=c.globalAlpha;
        c.globalAlpha=0.12*alpha;
        c.fillStyle=TEAM_COLORS[u.team]||"#888";
        c.beginPath();
        c.ellipse((u.x+reactX)|0,(u.y+reactY-bobY)|0,(u.z||10)*1.4,(u.z||10)*1.6,0,0,Math.PI*2);
        c.fill();
        c.globalAlpha=oldAlpha;
        // PERF-R12: avoid save/restore — just swap globalAlpha (cheaper than stack push/pop).
        c.globalAlpha=alpha;
        if(cached&&cached.width>0&&cached.height>0)c.drawImage(cached, dx, dy);
        c.globalAlpha=oldAlpha;
        // Draw face on top (dynamic — tracks target).
        // PERF-R12: skip face when >30 units (tiny visual detail, expensive transform).
        if(recipe.face!==false&&state!=="death"&&SpriteRenderer._frameUnitCount<=30){
          const saveY=u.y, saveX=u.x;
          u.y=saveY+bobY+reactY;
          u.x=saveX+reactX;
          c.save();
          c.globalAlpha=alpha;
          c.translate(u.x,u.y);
          c.scale(spriteScale,spriteScale);
          c.translate(-u.x,-u.y);
          if(u.team==="enemy"){c.translate(u.x,u.y);c.scale(-1,1);c.translate(-u.x,-u.y);}
          this.drawFace(c,u,channels,state);
          c.restore();
          u.y=saveY; u.x=saveX;
        }
        return;
      }
    }

    // Fallback: full per-frame rendering (death, reducedMotion, hitReact, or cache miss).
    // PERF-R12: if fast path was taken (channels=null), recompute full channels now.
    // This only happens on cache miss (first frame per unique sprite) — rare.
    if(channels===null)channels=this.interpolate(keyframes,t);
    c.save();
    c.globalAlpha=alpha;
    // D5: scale sprite by z so limbs are visible (shapes are designed for z=10).
    const spriteScale=Math.max(0.1,(u.z||10)/10*1.8);
    c.translate(u.x,u.y);
    c.scale(spriteScale,spriteScale);
    c.translate(-u.x,-u.y);
    // D5: enemy units face left — mirror horizontally around the unit.
    if(u.team==="enemy"){c.translate(u.x,u.y);c.scale(-1,1);c.translate(-u.x,-u.y);}
    if(rot){c.translate(u.x,u.y);c.rotate(rot*Math.PI/180);c.translate(-u.x,-u.y);}
    // Draw shapes (with bob offset applied via temporary y adjustment).
    const saveY=u.y;
    // D4: hit reaction — recoil away from attacker.
    let reactX=0,reactY=0;
    if(u.hitReact>0){
      const dir=u.hitReactDir||_zeroDir;
      reactX=dir.x*3*u.hitReact;
      reactY=dir.y*3*u.hitReact;
      u.hitReact-=0.015;
    }
    u.y=saveY+bobY+reactY;
    const drawX=u.x+reactX;
    const origX=u.x;
    u.x=drawX;
    // D3: team-colored ground decal (flat ellipse at feet) + base ring.
    if(state!=="death"){
      c.save();
      c.globalAlpha=0.3*alpha;
      c.fillStyle=TEAM_COLORS[u.team]||"#888";
      c.beginPath();
      c.ellipse(drawX,saveY+(u.z||10)*0.85,(u.z||10)*1.1,(u.z||10)*0.35,0,0,Math.PI*2);
      c.fill();
      // Team-colored stroke ring — clear visual team indicator at unit's base.
      c.globalAlpha=0.6*alpha;
      c.strokeStyle=TEAM_COLORS[u.team]||"#888";
      c.lineWidth=1.5;
      c.beginPath();
      c.ellipse(drawX,saveY+(u.z||10)*0.85,(u.z||10)*1.1,(u.z||10)*0.35,0,0,Math.PI*2);
      c.stroke();
      c.restore();
    }
    // Phase 24b: drop shadow — soft ellipse under the unit (D2).
    // PERF-R11: removed c.filter="blur(3px)" — canvas blur is 10-50x slower
    // than a regular fill and causes frame drops on mobile/low-end GPUs.
    // The shadow is now a flat semi-transparent ellipse (visually similar).
    if(!recipe.noShadow&&state!=="death"){
      c.save();
      c.globalAlpha=0.25*alpha;
      c.fillStyle="#000";
      c.beginPath();
      c.ellipse(drawX,saveY+(u.z||10)*0.8,(u.z||10)*0.9,(u.z||10)*0.3,0,0,Math.PI*2);
      c.fill();
      c.restore();
    }
    // Team-colored outline glow — subtle aura behind the unit for team ID.
    if(state!=="death"){
      c.save();
      c.globalAlpha=0.12*alpha;
      c.fillStyle=TEAM_COLORS[u.team]||"#888";
      c.beginPath();
      c.ellipse(drawX,saveY-(u.z||10)*0.3,(u.z||10)*1.4,(u.z||10)*1.6,0,0,Math.PI*2);
      c.fill();
      c.restore();
    }
    for(const shape of(recipe.shapes||[])){
      this.drawShape(c,shape,rm?{}:channels,u);
    }
    // Silhouette outline: draw a thin black outline around the entire sprite
    // by re-stroking all shapes with a unified black stroke at slightly larger width.
    // PERF-R11: skip this second pass when many units are on screen (doubles draw calls).
    // Each shape already has its own black outline via strokeBlack() in _drawShapeRaw.
    if(state!=="death"&&recipe.shapes&&Battle.units.length<=12){
      c.save();
      c.globalAlpha=alpha*0.6;
      c.strokeStyle="#000";
      c.lineWidth=1.5;
      for(const shape of recipe.shapes){
        if(shape.t==="line")continue; // skip lines (they're already strokes)
        this._strokeShape(c,shape,rm?{}:channels,u);
      }
      c.restore();
    }
    u.x=origX;
    // Phase 24f: draw face (eyes + expression) for humanoid-like units.
    if(recipe.face!==false&&state!=="death"){
      this.drawFace(c,u,channels,state);
    }
    u.y=saveY;
    c.restore();
  },

  // Phase 24f: faces — eyes that track targets, blink, widen on attack.
  drawFace(c,u,channels,state){
    // Only draw faces for humanoid-like body plans.
    // PERF-R12: hoist facedPlans set (avoid per-call array allocation).
    if(u.bodyPlan&&!_facedPlans.has(u.bodyPlan))return;
    // Phase 25: skip face if recipe says face:false or eyeStyle is closed.
    if(u.recipe&&(u.recipe.face===false||u.recipe.eyeStyle==="closed"))return;
    // Find head position (top of the unit).
    const hx=u.x;
    const hy=u.y-18;
    if(hy<-30)return; // off-screen check
    // Phase 25: eye color from recipe.eyeColor or derived from fxType.
    const fxType=u.fxType||deriveFxType(u);
    let eyeColor,eyeGlow;
    const eyeStyle=u.recipe?.eyeStyle||"normal";
    if(u.recipe&&u.recipe.eyeColor){
      eyeColor=u.recipe.eyeColor;
      eyeGlow=["glowing","visorglow","star","spiral"].includes(eyeStyle)?6:0;
    }else{
      eyeColor=u.bodyPlan==="undead"?"#4f4":fxType==="shadow"||fxType==="arcane"?"#f4f":"#000";
      eyeGlow=fxType==="shadow"||fxType==="arcane"||u.bodyPlan==="undead"?4:0;
    }
    // Blink: every 3-5s, 100ms scale-Y to 0.1.
    if(!u.faceState)u.faceState={blinkT:3+Math.random()*2,blinkPhase:0};
    u.faceState.blinkT-=0.016;
    if(u.faceState.blinkT<=0){
      u.faceState.blinkPhase=0.1;
      u.faceState.blinkT=3+Math.random()*2;
    }
    if(u.faceState.blinkPhase>0)u.faceState.blinkPhase-=0.016;
    const eyeScaleY=u.faceState.blinkPhase>0?0.1:1;
    // Widen on attack, narrow on death.
    let eyeScaleX=1;
    if(state==="attack")eyeScaleX=1.3;
    // Target tracking: shift eyes toward target.
    // PERF-R12: skip target tracking when many units (Math.hypot per unit per frame).
    let dx=0,dy=0;
    if(SpriteRenderer._frameUnitCount<=30&&u.target&&u.target.h>0){
      const tdx=u.target.x-u.x,tdy=u.target.y-u.y;
      // PERF-R12: Math.sqrt is faster than Math.hypot for 2 args.
      const td=Math.sqrt(tdx*tdx+tdy*tdy)||1;
      dx=(tdx/td)*1.5;dy=(tdy/td)*1.5;
    }
    c.save();
    // PERF-R11: skip shadowBlur on glowing eyes when many units (expensive GPU op).
    if(eyeGlow&&SpriteRenderer._frameUnitCount<=10){c.shadowBlur=eyeGlow;c.shadowColor=eyeColor;}
    c.fillStyle=eyeColor;
    // Render eyes differently based on eye style.
    switch(eyeStyle){
      case "slit":
        // Vertical slit pupils — cat/reptile eyes.
        c.beginPath();c.ellipse(hx-3+dx,hy+dy,2*eyeScaleX,3*eyeScaleY,0,0,Math.PI*2);c.fill();
        c.beginPath();c.ellipse(hx+3+dx,hy+dy,2*eyeScaleX,3*eyeScaleY,0,0,Math.PI*2);c.fill();
        c.fillStyle="#000";
        c.beginPath();c.ellipse(hx-3+dx,hy+dy,0.5,2.5*eyeScaleY,0,0,Math.PI*2);c.fill();
        c.beginPath();c.ellipse(hx+3+dx,hy+dy,0.5,2.5*eyeScaleY,0,0,Math.PI*2);c.fill();
        break;
      case "compound":
        // Compound eyes — multiple small circles per eye (insect).
        for(let i=0;i<4;i++){
          const a=i*Math.PI/2;
          c.beginPath();c.arc(hx-4+Math.cos(a)*2+dx,hy+Math.sin(a)*2+dy,1.2,0,Math.PI*2);c.fill();
          c.beginPath();c.arc(hx+4+Math.cos(a)*2+dx,hy+Math.sin(a)*2+dy,1.2,0,Math.PI*2);c.fill();
        }
        break;
      case "visor":
      case "visor_red":
      case "visorglow":
        // Single horizontal visor bar across both eyes.
        c.fillRect(hx-7+dx,hy-1.5+dy,14*eyeScaleX,3);
        if(eyeGlow){c.shadowBlur=0;}
        c.fillStyle="#000";
        c.fillRect(hx-7+dx,hy-1.5+dy,14*eyeScaleX,1);
        break;
      case "cross":
        // X-shaped eyes (dazed/stunned look).
        c.lineWidth=1.5;c.strokeStyle=eyeColor;
        c.beginPath();c.moveTo(hx-4+dx,hy-2+dy);c.lineTo(hx-2+dx,hy+2+dy);
        c.moveTo(hx-2+dx,hy-2+dy);c.lineTo(hx-4+dx,hy+2+dy);c.stroke();
        c.beginPath();c.moveTo(hx+2+dx,hy-2+dy);c.lineTo(hx+4+dx,hy+2+dy);
        c.moveTo(hx+4+dx,hy-2+dy);c.lineTo(hx+2+dx,hy+2+dy);c.stroke();
        break;
      case "star":
        // Star-shaped glowing eyes.
        c.lineWidth=1;c.strokeStyle=eyeColor;
        for(const ox of [-3,3]){
          c.beginPath();
          for(let i=0;i<10;i++){
            const a=i*Math.PI/5-Math.PI/2;
            const r=i%2===0?2.5:1;
            const px=hx+ox+Math.cos(a)*r*eyeScaleX+dx;
            const py=hy+Math.sin(a)*r*eyeScaleY+dy;
            if(i===0)c.moveTo(px,py);else c.lineTo(px,py);
          }
          c.closePath();c.fill();
        }
        break;
      case "spiral":
        // Spiral eyes (hypnotic).
        c.lineWidth=1;c.strokeStyle=eyeColor;
        for(const ox of [-3,3]){
          c.beginPath();
          for(let i=0;i<20;i++){
            const a=i*0.5;
            const r=i*0.15;
            const px=hx+ox+Math.cos(a)*r*eyeScaleX+dx;
            const py=hy+Math.sin(a)*r*eyeScaleY+dy;
            if(i===0)c.moveTo(px,py);else c.lineTo(px,py);
          }
          c.stroke();
        }
        break;
      case "empty":
        // Hollow black eyes (undead/eldritch).
        c.beginPath();c.arc(hx-3+dx,hy+dy,2.5*eyeScaleX,0,Math.PI*2);c.fill();
        c.beginPath();c.arc(hx+3+dx,hy+dy,2.5*eyeScaleX,0,Math.PI*2);c.fill();
        break;
      default:
        // Normal + glowing — two ellipses (original behavior).
        c.beginPath();
        c.ellipse(hx-3+dx,hy+dy,1.5*eyeScaleX,2*eyeScaleY,0,0,Math.PI*2);
        c.fill();
        c.beginPath();
        c.ellipse(hx+3+dx,hy+dy,1.5*eyeScaleX,2*eyeScaleY,0,0,Math.PI*2);
        c.fill();
    }
    if(eyeGlow)c.shadowBlur=0;
    c.restore();
  },

  // Role-coded fallback shape (same as Phase 19a drawShape).
  _drawRoleShape(c,u){
    const r=u.z;
    c.beginPath();
    switch(u.role){
      case "frontline":c.rect(u.x-r,u.y-r,r*2,r*2);break;
      case "carry":c.moveTo(u.x,u.y-r);c.lineTo(u.x+r,u.y+r);c.lineTo(u.x-r,u.y+r);c.closePath();break;
      case "counter":c.moveTo(u.x,u.y-r);c.lineTo(u.x+r,u.y);c.lineTo(u.x,u.y+r);c.lineTo(u.x-r,u.y);c.closePath();break;
      case "support":
        for(let i=0;i<6;i++){
          const a=i*Math.PI/3-Math.PI/2;
          const px=u.x+r*Math.cos(a),py=u.y+r*Math.sin(a);
          if(i===0)c.moveTo(px,py);else c.lineTo(px,py);
        }
        c.closePath();break;
      default:c.arc(u.x,u.y,r,0,Math.PI*2);
    }
  },

  // Phase 14: render a static sprite preview onto a canvas element.
  // Used by scout cards and deck cards to show unit visuals.
  renderPreview(canvas,u){
    if(!canvas||!u)return;
    const c=canvas.getContext("2d");
    if(!c)return;
    const w=canvas.width,h=canvas.height;
    if(w<1||h<1)return;
    c.clearRect(0,0,w,h);
    // D5: sprite is scaled by z/10*1.8 in draw(). Cap z so the sprite fits:
    // sprite height ~36px at scale 1, so z/10*1.8*36 <= h*0.85 → z <= h*0.85/(36*0.18).
    const z=Math.min(u.z||10,h*0.13);
    const tmp={...u,x:w/2,y:h*0.6,z,animState:"idle"};
    // Temporarily set Battle.time for animation interpolation (idle pose).
    const savedTime=Battle.time;
    Battle.time=0;
    this.draw(c,tmp);
    Battle.time=savedTime;
  },
};

// Phase 17: Procedural FX System — particles, hit flashes, screen shake.
// State-derived so P2P guests see the same juice without extra network traffic.
// Phase 30: Audio system — procedural Web Audio (no asset files).
const GameAudio={
  ctx:null,master:null,sfxGain:null,musicGain:null,
  enabled:true,sfxVol:0.7,musicVol:0.4,
  musicOsc:[],musicGainNodes:[],musicInterval:null,
  _sfxRate:0,
  init(){
    if(this.ctx)return;
    try{
      this.ctx=new (window.AudioContext||window.webkitAudioContext)();
      this.master=this.ctx.createGain();this.master.connect(this.ctx.destination);
      this.sfxGain=this.ctx.createGain();this.sfxGain.connect(this.master);
      this.musicGain=this.ctx.createGain();this.musicGain.connect(this.master);
      this.applyVolumes();
    }catch(e){console.warn("Audio init failed:",e);}
  },
  applyVolumes(){
    if(!this.ctx)return;
    this.sfxGain.gain.value=this.enabled?this.sfxVol:0;
    this.musicGain.gain.value=this.enabled?this.musicVol:0;
  },
  resume(){
    if(this.ctx&&this.ctx.state==="suspended"){this.ctx.resume().catch(e=>console.warn("Audio resume failed:",e));}
  },
  // SFX synthesizer — plays a named sound via oscillators/noise.
  sfx(name,opts={}){
    if(!this.ctx||!this.enabled)return;
    // Rate limit: max 30 SFX per second to prevent audio clipping.
    this._sfxRate=(this._sfxRate||0)+1;
    if(this._sfxRate>30)return;
    if(!this._sfxRateTimer){this._sfxRateTimer=setTimeout(()=>{this._sfxRate=0;this._sfxRateTimer=null;},1000);}
    if(this.ctx.state==="suspended")this.ctx.resume();
    const c=this.ctx;
    const pitch=opts.pitch||0;
    const make=(type,f0,f1,dur,gain,filter)=>{
      const t2=c.currentTime;
      const osc=c.createOscillator();osc.type=type;
      osc.frequency.setValueAtTime(f0*Math.pow(1.06,pitch),t2);
      osc.frequency.exponentialRampToValueAtTime(Math.max(1,f1*Math.pow(1.06,pitch)),t2+dur);
      const g=c.createGain();g.gain.setValueAtTime(gain,t2);
      g.gain.exponentialRampToValueAtTime(0.001,t2+dur);
      let nodes=[osc,g];
      if(filter){
        const f=c.createBiquadFilter();f.type=filter.type||"lowpass";
        f.frequency.value=filter.freq||800;
        osc.connect(f);f.connect(g);nodes.push(f);
      }else{osc.connect(g);}
      g.connect(this.sfxGain);
      osc.start(t2);osc.stop(t2+dur);
      // Disconnect nodes after playback to prevent audio graph memory leaks.
      osc.onended=()=>{nodes.forEach(n=>{try{n.disconnect();}catch(e){}});};
    };
    const noise=(dur,gain,filterFreq,filterType)=>{
      const tN=c.currentTime;
      const buf=c.createBuffer(1,c.sampleRate*dur,c.sampleRate);
      const d=buf.getChannelData(0);
      for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
      const src=c.createBufferSource();src.buffer=buf;
      const f=c.createBiquadFilter();f.type=filterType||"lowpass";f.frequency.value=filterFreq||800;
      const g=c.createGain();g.gain.setValueAtTime(gain,tN);
      g.gain.exponentialRampToValueAtTime(0.001,tN+dur);
      src.connect(f);f.connect(g);g.connect(this.sfxGain);
      src.start(tN);src.stop(tN+dur);
      src.onended=()=>{try{src.disconnect();f.disconnect();g.disconnect();}catch(e){}};
    };
    switch(name){
      case "attack_melee":{
        // I3: weapon-type-specific melee sounds.
        const wt=opts.weaponType||"sword";
        if(wt==="claw"){noise(0.08,0.12,400,"bandpass");}
        else if(wt==="staff"){make("sine",400,600,0.1,0.1,{type:"highpass",freq:300});}
        else{make("square",300,80,0.08,0.15,{type:"lowpass",freq:600});} // sword
        break;
      }
      case "attack_ranged":{
        // I3: bow = string twang, staff = magical shimmer.
        const wt=opts.weaponType||"bow";
        if(wt==="staff"){make("sine",400,800,0.1,0.1,{type:"highpass",freq:300});}
        else{make("triangle",800,1200,0.06,0.12,{type:"bandpass",freq:800});} // bow
        break;
      }
      case "hit":noise(0.05,0.15,800,"lowpass");break;
      case "crit":noise(0.05,0.15,800,"lowpass");make("square",400,400,0.12,0.1);break;
      case "death":make("sawtooth",150,40,0.2,0.15);break;
      case "spawn":make("sine",200,600,0.1,0.1);break;
      case "heal":make("sine",400,800,0.2,0.08);break;
      case "explode":noise(0.3,0.2,2000,"lowpass");break;
      case "shield":make("square",300,300,0.15,0.08);break;
      case "spell_fire":noise(0.4,0.12,2000,"lowpass");make("sawtooth",80,60,0.4,0.08);break;
      case "spell_frost":make("sine",1200,1200,0.3,0.06,{type:"highpass",freq:1000});break;
      case "spell_lightning":make("square",2000,2000,0.04,0.15);break;
      case "ui_click":make("sine",800,800,0.03,0.05);break;
      case "ui_hover":make("sine",600,600,0.02,0.03);break;
      case "round_start":make("sawtooth",110,110,0.6,0.1);make("sawtooth",220,220,0.6,0.08);break;
      case "round_win":make("sine",440,440,0.15,0.1);setTimeout(()=>make("sine",554,554,0.15,0.1),150);setTimeout(()=>make("sine",659,659,0.3,0.1),300);break;
      case "round_lose":make("sine",440,440,0.2,0.1);setTimeout(()=>make("sine",392,392,0.2,0.1),200);setTimeout(()=>make("sine",330,330,0.4,0.1),400);break;
      case "match_win":make("sine",440,440,0.15,0.1);setTimeout(()=>make("sine",554,554,0.15,0.1),150);setTimeout(()=>make("sine",659,659,0.15,0.1),300);setTimeout(()=>make("sine",880,880,0.5,0.12),450);break;
      case "match_lose":make("sawtooth",220,220,0.3,0.1);setTimeout(()=>make("sawtooth",196,196,0.3,0.1),300);setTimeout(()=>make("sawtooth",165,165,0.6,0.1),600);break;
      case "forge_whoosh":noise(0.5,0.1,1000,"bandpass");break;
      case "forge_reveal":make("sine",200,1200,0.4,0.1);break;
      case "ramp_up":make("sine",400,800,0.08,0.08);break;
      case "coin":make("sine",880,880,0.05,0.08);setTimeout(()=>make("sine",1320,1320,0.08,0.06),50);break;
      case "level_up":make("sine",440,440,0.08,0.08);setTimeout(()=>make("sine",554,554,0.08,0.08),80);setTimeout(()=>make("sine",659,659,0.15,0.1),160);break;
      case "achievement":make("sine",659,659,0.1,0.1);setTimeout(()=>make("sine",880,880,0.1,0.1),100);setTimeout(()=>make("sine",1047,1047,0.3,0.12),200);break;
      case "draft_pick":make("triangle",600,900,0.08,0.06);break;
      case "reroll":make("sine",300,600,0.15,0.06);break;
      case "error":make("sawtooth",200,150,0.15,0.08);break;
      case "first_blood":make("sine",330,330,0.1,0.12);setTimeout(()=>make("sine",440,440,0.1,0.12),100);setTimeout(()=>make("sine",554,554,0.2,0.14),200);break;
      case "clutch":make("sine",523,523,0.08,0.1);setTimeout(()=>make("sine",659,659,0.08,0.1),80);setTimeout(()=>make("sine",784,784,0.08,0.1),160);setTimeout(()=>make("sine",1047,1047,0.3,0.12),240);break;
      case "low_hp_warn":make("sine",800,400,0.15,0.06);break;
    }
  },
  // Procedural music — generative ambient loop.
  // I2: Arena-specific music patterns (different scales per arena).
  startMusic(){
    if(!this.ctx||!this.enabled)return;
    if(this.musicInterval)return;
    const arenaIdx=G.save?.arena||0;
    // I2: Arena-specific root notes and scale patterns.
    const patterns=[
      {root:261.63,scale:[1,1.25,1.5,1.875],type:"sine"},     // Training Yard: major arpeggio
      {root:220,scale:[1,1.125,1.5,1.78],type:"triangle"},     // District Z: minor drone
      {root:293.66,scale:[1,1.125,1.375,1.625],type:"sine"},   // Golden Goal: pentatonic
      {root:233.08,scale:[1,1.067,1.2,1.414],type:"sawtooth"}, // Void Rift: chromatic/diminished
    ];
    const pat=patterns[arenaIdx]||patterns[0];
    const root=pat.root;
    // Bass drone.
    const bass=this.ctx.createOscillator();bass.type=pat.type;bass.frequency.value=root/2;
    const bg=this.ctx.createGain();bg.gain.value=0.08;
    bass.connect(bg);bg.connect(this.musicGain);bass.start();
    this.musicOsc=[bass];
    this.musicGainNodes=[bg];
    // Slow arpeggio using arena-specific scale.
    const notes=pat.scale.map(s=>root*s);
    let step=0;
    this.musicInterval=setInterval(()=>{
      if(!this.ctx||!this.enabled){this.stopMusic();return;}
      const t=this.ctx.currentTime;
      const osc=this.ctx.createOscillator();osc.type=pat.type;
      osc.frequency.value=notes[step%notes.length];
      const g=this.ctx.createGain();g.gain.setValueAtTime(0.05,t);
      g.gain.exponentialRampToValueAtTime(0.001,t+0.8);
      osc.connect(g);g.connect(this.musicGain);
      osc.start(t);osc.stop(t+0.8);
      // Disconnect after playback to prevent audio graph accumulation.
      osc.onended=()=>{try{osc.disconnect();g.disconnect();}catch(e){}};
      step++;
    },800);
  },
  // I1: Ambient menu/forge music — calmer, lower gain.
  startAmbient(){
    if(!this.ctx||!this.enabled)return;
    if(this.musicInterval)return; // already playing
    const root=174.61; // F3 — calm base
    const bass=this.ctx.createOscillator();bass.type="sine";bass.frequency.value=root/2;
    const bg=this.ctx.createGain();bg.gain.value=0.04; // lower gain for ambient
    bass.connect(bg);bg.connect(this.musicGain);bass.start();
    this.musicOsc=[bass];
    this.musicGainNodes=[bg];
    const notes=[root,root*1.2,root*1.5,root*1.2];
    let step=0;
    this.musicInterval=setInterval(()=>{
      if(!this.ctx||!this.enabled){this.stopMusic();return;}
      const t=this.ctx.currentTime;
      const osc=this.ctx.createOscillator();osc.type="sine";
      osc.frequency.value=notes[step%notes.length];
      const g=this.ctx.createGain();g.gain.setValueAtTime(0.03,t);
      g.gain.exponentialRampToValueAtTime(0.001,t+1.2); // longer notes
      osc.connect(g);g.connect(this.musicGain);
      osc.start(t);osc.stop(t+1.2);
      osc.onended=()=>{try{osc.disconnect();g.disconnect();}catch(e){}};
      step++;
    },1200); // slower tempo
  },
  stopMusic(){
    if(this.musicInterval){clearInterval(this.musicInterval);this.musicInterval=null;}
    for(const o of this.musicOsc){try{o.stop();}catch(e){}}
    this.musicOsc=[];
    if(this.musicGainNodes){for(const g of this.musicGainNodes){try{g.disconnect();}catch(e){}}this.musicGainNodes=[];}
  },
};
// Phase 30: fxType → base frequency for attack SFX.
function fxTypeFreq(fxType){
  switch(fxType){
    case "fire":return 0; case "frost":return 200; case "lightning":return 400;
    case "poison":return -100; case "heal_glow":return 300; case "shadow":return -50;
    case "shockwave":return 100; case "fire_wall":return -50;
    default:return 0;
  }
}

const MAX_PARTICLES=100; // QUICKWIN: was 60 — felt sparse on big spells
// PERF-R12: particle pool — reuse dead particles to avoid GC pressure.
// Particles are created/destroyed frequently (every hit, aura tick, spell).
const _particlePool=[];
function _spawnParticle(x,y,vx,vy,life,maxLife,c,r){
  const p=_particlePool.length?_particlePool.pop():{};
  p.x=x;p.y=y;p.vx=vx;p.vy=vy;p.life=life;p.maxLife=maxLife;p.c=c;p.r=r;
  Battle.particles.push(p);
}
// PERF-R12: return dead particles to pool during compaction.
function _recycleParticle(p){_particlePool.push(p);}
// Phase 24e: derive elemental fxType from unit attributes for auras.
const AURA_MAP={
  fire:"#f64", frost:"#6cf", poison:"#6f4", lightning:"#ff4",
  holy:"#fd8", shadow:"#a4f", arcane:"#a4f", explosion:"#f84",
  heal_glow:"#fd8", shockwave:"#fff", fire_wall:"#f84",
  void:"#a0f", nature:"#4f8", blood:"#f44", tech:"#0ff",
};
function deriveFxType(u){
  if(u.ability==="ramp"&&u.weaponType==="breath")return"fire";
  if(u.ability==="poison")return"poison";
  if(u.ability==="heal"||u.ability==="heal_burst")return"heal_glow";
  if(u.ability==="explode")return"explosion";
  if(u.ability==="shield")return"holy";
  if(u.weaponType==="staff"||u.weaponType==="orb")return"arcane";
  if(u.bodyPlan==="ghost"||u.bodyPlan==="undead"||u.bodyPlan==="wraith")return"shadow";
  if(u.bodyPlan==="dragon"||u.bodyPlan==="wyvern")return"fire";
  if(u.bodyPlan==="bird")return"frost";
  if(u.bodyPlan==="plant"||u.bodyPlan==="treant")return"holy";
  if(u.bodyPlan==="spider"||u.bodyPlan==="kraken")return"poison";
  if(u.bodyPlan==="gargoyle")return"shadow";
  return null;
}
const BattleFX={
  // Spawn particles at a position with given color + count.
  burst(x,y,color,count,speed){
    if(G.save?.settings?.reducedMotion)return;
    const n=Math.min(count,MAX_PARTICLES-(Battle.particles?.length||0));
    for(let i=0;i<n;i++){
      const a=Math.random()*Math.PI*2;
      const v=speed*(0.5+Math.random()*0.5);
      _spawnParticle(x,y,Math.cos(a)*v,Math.sin(a)*v,0.3+Math.random()*0.2,0.5,color,2+Math.random()*2);
    }
  },
  // Hit flash: unit flashes white briefly.
  onHit(u){
    if(G.save?.settings?.reducedMotion)return;
    u.hitFlash=0.08; // 80ms
  },
  // Crit burst: gold flash + 6-particle spark + screen shake.
  onCrit(u){
    u.hitFlash=0.08;
    if(G.save?.settings?.reducedMotion)return; // skip particles/shake in reduced motion
    this.burst(u.x,u.y,"#fd4",6,80);
    this.shake(3);
  },
  // Death burst: expand + fade + 8 particles.
  onDeath(u){
    if(G.save?.settings?.reducedMotion)return;
    this.burst(u.x,u.y,u.c,8,60);
    if(u.role==="carry")this.shake(4); // carry death = bigger shake
  },
  // Phase 20: ramp kill — golden particle burst + brief size pulse.
  onKill(u){
    u.hitFlash=0.08;
    if(G.save?.settings?.reducedMotion)return;
    this.burst(u.x,u.y,"#fd4",5,70);
    GameAudio.sfx("ramp_up"); // Phase 30
  },
  // Phase 23: spell cast FX — big burst at anchor + screen shake.
  onSpell(spec,anchor,affected,team){
    if(!anchor)return;
    const ax=anchor.x??0,ay=anchor.y??0;
    // Mark affected units with hit flash (always, even in reduced motion).
    // PERF-R13: index loop (avoid forEach closure allocation).
    for(let ai=0;ai<affected.length;ai++)affected[ai].hitFlash=0.1;
    if(G.save?.settings?.reducedMotion)return; // skip particles/shake in reduced motion
    // PERF-R12: use hoisted SPELL_FX_COLORS constant (avoid per-call object allocation).
    const color=SPELL_FX_COLORS[spec.fxType]||"#fff";
    const count=spec.shape==="persistent_zone"?8:spec.shape==="circle_aoe"?12:6;
    this.burst(ax,ay,color,count,100);
    this.shake(spec.fxType==="explosion"?6:3);
  },
  // Phase 23: persistent zone FX — particles at zone perimeter.
  spellZone(z){
    // PERF-R12: use hoisted ZONE_FX_COLORS constant (avoid per-call object allocation).
    const color=ZONE_FX_COLORS[z.spec.fxType]||"#fa4";
    const budget=MAX_PARTICLES-(Battle.particles?.length||0);
    if(budget<=0)return;
    const n=Math.min(3,budget);
    for(let i=0;i<n;i++){
      const a=Math.random()*Math.PI*2;
      const r=z.radius*(0.7+Math.random()*0.3);
      _spawnParticle(z.x+Math.cos(a)*r,z.y+Math.sin(a)*r,0,-10-Math.random()*10,0.4+Math.random()*0.2,0.6,color,2+Math.random()*2);
    }
  },
  // Phase 24e: persistent unit aura — per-frame particle emitter driven by fxType.
  unitAura(u,dt){
    if(u.h<=0||u.deathT!==undefined)return;
    // PERF-R12: quality/reducedMotion already checked by caller (update loop).
    // Phase 25: prefer recipe.auraColor, then deriveFxType.
    let fxType=u.fxType||deriveFxType(u);
    let color=u.recipe&&u.recipe.auraColor?u.recipe.auraColor:AURA_MAP[fxType];
    if(!color){
      // Try recipe.aura directly.
      if(u.recipe&&u.recipe.aura&&u.recipe.aura!=="none")color=AURA_MAP[u.recipe.aura];
    }
    if(!color)return;
    // Spawn 1-2 particles per frame, capped by MAX_PARTICLES.
    // PERF-R12: cache particles array reference (avoid 100× optional chaining per frame).
    const particles=Battle.particles;
    const budget=MAX_PARTICLES-(particles?particles.length:0);
    if(budget<=0)return;
    const count=Math.min(2,budget);
    const auraType=u.recipe?.aura||fxType||"none";
    for(let i=0;i<count;i++){
      const px=u.x+(Math.random()-0.5)*16;
      const py=u.y+(Math.random()-0.5)*4;
      let vx=0,vy=0,life=0.5,r=2;
      switch(fxType){
        case "fire": case "explosion": case "fire_wall":
          vy=-20-Math.random()*20; life=0.4+Math.random()*0.3; r=1.5+Math.random(); break;
        case "frost":
          vy=10+Math.random()*10; life=0.6+Math.random()*0.3; r=1+Math.random(); break;
        case "poison":
          vy=-5-Math.random()*10; vx=(Math.random()-0.5)*10; life=0.5+Math.random()*0.3; r=2+Math.random(); break;
        case "lightning":
          vx=(Math.random()-0.5)*30; vy=(Math.random()-0.5)*30; life=0.1+Math.random()*0.1; r=1+Math.random(); break;
        case "heal_glow": case "holy":
          vy=-15-Math.random()*10; life=0.5+Math.random()*0.3; r=1.5+Math.random(); break;
        case "shadow": case "arcane":
          vx=(Math.random()-0.5)*8; vy=-8-Math.random()*8; life=0.4+Math.random()*0.3; r=1.5+Math.random(); break;
        default:
          vy=-10; life=0.4;
      }
      // Unique aura particle behaviors for visual modifier auras.
      if(auraType==="void"){
        // Imploding particles — spiral inward then fade.
        const ang=Math.random()*Math.PI*2;
        const dist=12+Math.random()*6;
        vx=-Math.cos(ang)*15; vy=-Math.sin(ang)*15;
        life=0.4+Math.random()*0.2; r=1.5+Math.random();
      }else if(auraType==="nature"){
        // Falling leaves — drift down with sway.
        vx=(Math.random()-0.5)*8; vy=5+Math.random()*8;
        life=0.8+Math.random()*0.4; r=2+Math.random();
      }else if(auraType==="blood"){
        // Dripping droplets — fall straight down, heavier.
        vx=(Math.random()-0.5)*3; vy=15+Math.random()*10;
        life=0.5+Math.random()*0.3; r=1.5+Math.random();
      }else if(auraType==="tech"){
        // Digital squares — jittery, short-lived, rectangular look.
        vx=(Math.random()-0.5)*20; vy=(Math.random()-0.5)*20;
        life=0.15+Math.random()*0.1; r=1+Math.random();
      }
      _spawnParticle(px,py,vx,vy,life,life,color,r);
    }
  },
  // Spawn pop-in: scale 0->1 ease-out-back.
  onSpawn(u){
    if(!G.save?.settings?.reducedMotion)u.spawnT=0.001; // start spawn animation
    GameAudio.sfx("spawn"); // Phase 30
  },
  // Attack lunge: offset 4px toward target.
  onAttack(u,target){
    if(!target)return;
    const dx=target.x-u.x,dy=target.y-u.y;
    // PERF-R12: Math.sqrt is faster than Math.hypot for 2 args.
    const d=Math.sqrt(dx*dx+dy*dy)||1;
    u.lungeT=0.06; // 60ms
    // PERF-R12: reuse lungeDir object (avoid {x,y} allocation per attack).
    if(!u.lungeDir)u.lungeDir={x:0,y:0};
    u.lungeDir.x=dx/d;u.lungeDir.y=dy/d;
  },
  // Screen shake: ±px transform with decay.
  shake(amount){
    // Phase 32: skip shake if reduced motion.
    if(G.save?.settings?.reducedMotion)return;
    Battle.shakeAmount=Math.max(Battle.shakeAmount||0,amount);
  },
  // Round-end flash: full-canvas color wash.
  roundEnd(color){
    Battle.roundFlash={t:0,dur:0.4,c:color||"#fff"};
  },
  // Phase 17: fire recipe-based FX when a unit attacks.
  // Interprets the unit's weaponType to produce visual FX:
  // bow → projectile trail, staff → flash burst, hammer → impact burst.
  fireRecipeFx(u,target){
    if(!u||!target)return;
    const fxType=WEAPON_FX[u.weaponType]||WEAPON_FX.none;
    if(fxType==="projectile"){
      // Arrow projectile: small particle streak from unit to target.
      const dx=target.x-u.x,dy=target.y-u.y;
      // PERF-R12: Math.sqrt is faster than Math.hypot for 2 args.
      const d=Math.sqrt(dx*dx+dy*dy)||1;
      const steps=Math.min(5,Math.floor(d/20));
      for(let i=0;i<steps;i++){
        const t=i/steps;
        _spawnParticle(u.x+dx*t,u.y+dy*t,0,0,0.15+t*0.05,0.2,u.c,2);
      }
    }else if(fxType==="flash"){
      // Staff flash: bright particle burst at unit position.
      this.burst(u.x,u.y-10,"#ff0",4,40);
    }else if(fxType==="burst"){
      // Hammer impact: particle burst at target position.
      this.burst(target.x,target.y,"#fa0",6,60);
    }
  },
  // Update particles + timers.
  update(dt){
    // Update particles.
    if(Battle.particles){
      // PERF-R12: index loop (avoid for...of iterator allocation).
      for(let pi=0;pi<Battle.particles.length;pi++){
        const p=Battle.particles[pi];
        p.x+=p.vx*dt;
        p.y+=p.vy*dt;
        p.vx*=0.95;
        p.vy*=0.95;
        p.life-=dt;
      }
      // PERF-R12: in-place compaction instead of filter (avoids array allocation + GC).
      // PERF-R12: recycle dead particles to pool (reuse objects, avoid GC).
      let wp=0;
      for(let pi=0;pi<Battle.particles.length;pi++){
        const p=Battle.particles[pi];
        if(p.life>0&&!isNaN(p.x)&&!isNaN(p.y)){
          if(wp!==pi)Battle.particles[wp]=p;
          wp++;
        }else{
          _recycleParticle(p);
        }
      }
      Battle.particles.length=wp;
    }
    // Update screen shake decay.
    if(Battle.shakeAmount>0){
      Battle.shakeAmount*=0.85;
      if(Battle.shakeAmount<0.1)Battle.shakeAmount=0;
    }
    // Update round flash.
    if(Battle.roundFlash){
      Battle.roundFlash.t+=dt;
      if(Battle.roundFlash.t>=Battle.roundFlash.dur)Battle.roundFlash=null;
    }
  },
  // Draw particles on canvas.
  drawParticles(c){
    if(!Battle.particles||!Battle.particles.length)return;
    // Additive blending for energy/glow feel — overlapping particles brighten.
    const prev=c.globalCompositeOperation;
    c.globalCompositeOperation="lighter";
    // PERF-R12: skip halo when many particles (bloom is visual nicety, doubles arc count).
    const doHalo=Battle.particles.length<=30;
    // PERF-R12: index loop (avoid for...of iterator allocation).
    for(let pi=0;pi<Battle.particles.length;pi++){
      const p=Battle.particles[pi];
      const a=Math.max(0,p.life/p.maxLife);
      c.globalAlpha=a;
      c.fillStyle=p.c;
      c.beginPath();
      c.arc(p.x,p.y,p.r,0,Math.PI*2);
      c.fill();
      if(doHalo){
        // Soft glow halo — larger, fainter circle for bloom effect.
        c.globalAlpha=a*0.3;
        c.beginPath();
        c.arc(p.x,p.y,p.r*2.2,0,Math.PI*2);
        c.fill();
      }
    }
    c.globalAlpha=1;
    c.globalCompositeOperation=prev;
  },
  // Draw round-end flash overlay.
  drawRoundFlash(c){
    if(!Battle.roundFlash)return;
    const rf=Battle.roundFlash;
    const alpha=Math.max(0,1-rf.t/rf.dur)*0.3;
    c.globalAlpha=alpha;
    c.fillStyle=rf.c;
    c.fillRect(0,0,Battle.canvasW||400,Battle.canvasH||550);
    c.globalAlpha=1;
  },
  // Get lunge offset for a unit (for rendering).
  // PERF-R12: reusable lunge offset buffer (avoids allocation per call).
  _lungeBuf:{x:0,y:0},
  getLungeOffset(u){
    if(!u||u.lungeT<=0||!u.lungeDir){this._lungeBuf.x=0;this._lungeBuf.y=0;return this._lungeBuf;}
    const f=u.lungeT/0.06;
    const dist=4*f;
    this._lungeBuf.x=u.lungeDir.x*dist;this._lungeBuf.y=u.lungeDir.y*dist;
    return this._lungeBuf;
  },
  // Get spawn scale for a unit (ease-out-back).
  getSpawnScale(u){
    if(u.spawnT<=0)return 1;
    const t=Math.min(1,u.spawnT/0.15);
    // Ease-out-back: 1 + c3*(t-1)^3 + c1*(t-1)^2
    const c1=1.70158,c3=c1+1;
    return 1+c3*Math.pow(t-1,3)+c1*Math.pow(t-1,2);
  },
};

