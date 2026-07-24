function showScreen(id){
    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.querySelector('.tab[data-screen="'+id+'"]').classList.add('active');
  }
  document.querySelectorAll('.tab').forEach(t=>{
    t.addEventListener('click', ()=>showScreen(t.dataset.screen));
  });

  /* ---- Voice: real text-to-speech via the browser, no API needed ---- */
  function pickVoice(){
    const voices = speechSynthesis.getVoices();
    return voices.find(v=>/en/i.test(v.lang) && /female|samantha|victoria|karen/i.test(v.name))
        || voices.find(v=>/en/i.test(v.lang))
        || voices[0];
  }

  function speakText(text, onStart, onEnd){
    if(!('speechSynthesis' in window)){ alert('Voice is not supported in this browser.'); return; }
    speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    const v = pickVoice();
    if(v) utter.voice = v;
    utter.rate = 0.98; utter.pitch = 1.02;
    utter.onstart = ()=>{ if(onStart) onStart(); };
    utter.onend = ()=>{ if(onEnd) onEnd(); };
    speechSynthesis.speak(utter);
  }

  function speakMsg(btn){
    const text = btn.parentElement.textContent.replace(btn.textContent,'').trim();
    document.querySelectorAll('.speak-btn').forEach(b=>b.classList.remove('playing'));
    btn.classList.add('playing');
    speakText(text, null, ()=>btn.classList.remove('playing'));
  }

  function sendChatMsg(){
    const box = document.getElementById('chatInputBox');
    const text = box.value.trim();
    if(!text) return;
    const body = document.getElementById('chatBody');
    const u = document.createElement('div'); u.className='msg user'; u.textContent = text;
    body.appendChild(u);
    box.value='';
    body.scrollTop = body.scrollHeight;
  }

  /* ---- VIP live voice call (simulated back-and-forth, real TTS for AI side) ---- */
  const voiceReplies = [
    "I hear that. Let's slow down for a second — what does your gut say when you picture actually saying yes?",
    "That makes sense given your chart right now. Your Personal Year 8 rewards patience — this doesn't need to be decided today.",
    "Worth naming: is this fear about the move itself, or fear of choosing wrong? Those call for different next steps."
  ];
  let voiceTurn = 0;

  function openVoiceCall(){
    document.getElementById('chatBody').style.display='none';
    document.querySelector('.chat-input').style.display='none';
    document.getElementById('voiceOverlay').classList.add('active');
    const status = document.getElementById('voiceStatus');
    const transcript = document.getElementById('voiceTranscript');
    status.textContent='Connecting…';
    setTimeout(()=>{
      status.textContent='Connected';
      transcript.innerHTML = '<span class="said">Aureon:</span> Good to hear your voice — same conversation as before. Still deciding on Berlin?';
      speakText("Good to hear your voice, same conversation as before. Still deciding on Berlin?", ()=>document.getElementById('orb').classList.add('speaking'), ()=>document.getElementById('orb').classList.remove('speaking'));
    }, 900);
  }

  function sendVoiceMsg(){
    const box = document.getElementById('voiceInputBox');
    const said = box.value.trim();
    if(!said) return;
    box.value='';
    const transcript = document.getElementById('voiceTranscript');
    transcript.innerHTML = '<span class="said">You said:</span> '+said;
    document.getElementById('voiceStatus').textContent='Thinking…';
    setTimeout(()=>{
      document.getElementById('voiceStatus').textContent='Connected';
      const reply = voiceReplies[voiceTurn % voiceReplies.length];
      voiceTurn++;
      transcript.innerHTML = '<span class="said">Aureon:</span> '+reply;
      speakText(reply, ()=>document.getElementById('orb').classList.add('speaking'), ()=>document.getElementById('orb').classList.remove('speaking'));
    }, 700);
  }

  function closeVoiceCall(){
    speechSynthesis.cancel();
    document.getElementById('voiceOverlay').classList.remove('active');
    document.getElementById('chatBody').style.display='flex';
    document.querySelector('.chat-input').style.display='flex';
    voiceTurn = 0;
  }

  /* ---- Ambient cosmos: layered nebula glow + parallax starfield ---- */
  (function starfield(){
    const canvas = document.getElementById('starfield');
    const ctx = canvas.getContext('2d');
    let w, h, stars = [], nebulas = [];
    let mx = 0, my = 0;

    function resize(){
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
      const count = Math.round((w*h)/4500);
      stars = Array.from({length: count}, ()=>{
        const layer = Math.random();
        const tint = Math.random();
        const tintColor = tint < 0.7 ? '242,237,226' : tint < 0.87 ? '198,213,235' : '242,214,170';
        return {
          x: Math.random()*w,
          y: Math.random()*h,
          r: layer < 0.6 ? Math.random()*0.9+0.3 : Math.random()*1.8+0.8,
          depth: layer < 0.6 ? 0.3 : 1,
          baseAlpha: Math.random()*0.5 + 0.25,
          phase: Math.random()*Math.PI*2,
          speed: Math.random()*0.02 + 0.006,
          drift: Math.random()*0.12 + 0.02,
          color: tintColor
        };
      });
      nebulas = [
        {x:w*0.18, y:h*0.25, r: Math.max(w,h)*0.35, color:'201,162,74', depth:0.15},
        {x:w*0.82, y:h*0.15, r: Math.max(w,h)*0.28, color:'111,95,140', depth:0.25},
        {x:w*0.5,  y:h*0.85, r: Math.max(w,h)*0.32, color:'111,95,140', depth:0.1}
      ];
    }
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', e=>{
      mx = (e.clientX/w - 0.5);
      my = (e.clientY/h - 0.5);
    });
    resize();

    let t = 0;
    let comets = [];
    let nextCometAt = 90 + Math.random()*180;
    const ZODIAC = ['♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓'];
    function frame(){
      t += 1;
      ctx.clearRect(0,0,w,h);

      for(const n of nebulas){
        const nx = n.x + mx * 30 * n.depth;
        const ny = n.y + my * 30 * n.depth;
        const grad = ctx.createRadialGradient(nx,ny,0,nx,ny,n.r);
        grad.addColorStop(0, 'rgba('+n.color+',0.10)');
        grad.addColorStop(1, 'rgba('+n.color+',0)');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(nx,ny,n.r,0,Math.PI*2); ctx.fill();
      }

      for(const s of stars){
        s.y += s.drift * 0.05;
        if(s.y > h) s.y = 0;
        const twinkle = s.baseAlpha + Math.sin(t*s.speed + s.phase) * 0.25;
        const px = s.x + mx * 22 * s.depth;
        const py = s.y + my * 22 * s.depth;
        ctx.beginPath();
        ctx.arc(px, py, s.r, 0, Math.PI*2);
        ctx.fillStyle = 'rgba('+s.color+',' + Math.max(0, twinkle).toFixed(2) + ')';
        ctx.fill();
        if(s.depth === 1 && twinkle > 0.55){
          ctx.beginPath();
          ctx.arc(px, py, s.r*2.6, 0, Math.PI*2);
          ctx.fillStyle = 'rgba(201,162,74,' + (twinkle*0.12).toFixed(2) + ')';
          ctx.fill();
        }
      }

      drawOrbitSystem(ctx, w, h, t, mx, my);
      drawComets(ctx, w, h, t);

      requestAnimationFrame(frame);
    }
    frame();

    /* Occasional shooting stars streaking across the sky */
    function drawComets(ctx, w, h, t){
      if(t > nextCometAt){
        comets.push({
          x: Math.random()*w*0.5, y: Math.random()*h*0.3,
          vx: 6 + Math.random()*4, vy: 3 + Math.random()*2,
          life: 0, maxLife: 40
        });
        nextCometAt = t + 240 + Math.random()*360;
      }
      comets = comets.filter(c=>c.life < c.maxLife);
      for(const c of comets){
        c.life++;
        const cx2 = c.x + c.vx*c.life, cy2 = c.y + c.vy*c.life;
        const fade = 1 - c.life/c.maxLife;
        const grad = ctx.createLinearGradient(cx2, cy2, cx2 - c.vx*10, cy2 - c.vy*10);
        grad.addColorStop(0, 'rgba(255,250,235,'+(0.9*fade).toFixed(2)+')');
        grad.addColorStop(1, 'rgba(255,250,235,0)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(cx2, cy2);
        ctx.lineTo(cx2 - c.vx*10, cy2 - c.vy*10);
        ctx.stroke();
      }
    }

    /* Fully animated solar system — real planet order, zodiac ring, aspects, belt, retrograde */
    function drawOrbitSystem(ctx, w, h, t, mx, my){
      const cx = w*0.5 + mx*16, cy = h*0.46 + my*16;
      const scale = Math.min(w,h) * 1.55;
      const rot = -0.32 + Math.sin(t*0.0005)*0.025;

      // real order, roughly-real relative distance/size pattern, compressed timescale
      // (true orbital periods span 88 days to 165 years — compressed here so every
      // planet is visibly alive, but speed still decreases with distance like real physics)
      const planets = [
        { name:'Mercury', a:scale*0.075, b:scale*0.025, speed:0.00105, size:0.0042, color:'176,170,160', phase:0.4,  dTilt:0.008, retro:true },
        { name:'Venus',   a:scale*0.10,  b:scale*0.034, speed:0.00078, size:0.0068, color:'224,198,150', phase:2.6,  dTilt:-0.014 },
        { name:'Earth',   a:scale*0.13,  b:scale*0.044, speed:0.00062, size:0.0072, color:'118,160,182', phase:4.4,  dTilt:0.011, hasMoon:true },
        { name:'Mars',    a:scale*0.165, b:scale*0.056, speed:0.00050, size:0.0056, color:'196,110,80',  phase:1.1,  dTilt:-0.017 },
        { name:'Jupiter', a:scale*0.235, b:scale*0.080, speed:0.00033, size:0.0155, color:'214,178,132', phase:3.3,  dTilt:0.02  },
        { name:'Saturn',  a:scale*0.30,  b:scale*0.102, speed:0.00024, size:0.0135, color:'222,198,148', phase:5.2,  dTilt:-0.023, ring:true },
        { name:'Uranus',  a:scale*0.355, b:scale*0.121, speed:0.00017, size:0.0092, color:'160,206,206', phase:0.9,  dTilt:0.026 },
        { name:'Neptune', a:scale*0.41,  b:scale*0.14,  speed:0.00012, size:0.0088, color:'96,120,196',  phase:2.2,  dTilt:-0.03 }
      ];

      // zodiac ring — the outermost boundary of the whole system
      const zR = scale*0.47;
      ctx.beginPath(); ctx.ellipse(cx,cy,zR,zR*0.34,rot,0,Math.PI*2);
      ctx.strokeStyle = 'rgba(201,162,74,0.15)'; ctx.lineWidth = 0.6; ctx.stroke();
      ctx.font = (scale*0.016) + 'px serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for(let i=0;i<12;i++){
        const zAng = (i/12)*Math.PI*2 + t*0.00004;
        const zx = zR*Math.cos(zAng)*Math.cos(rot) - zR*0.34*Math.sin(zAng)*Math.sin(rot);
        const zy = zR*Math.cos(zAng)*Math.sin(rot) + zR*0.34*Math.sin(zAng)*Math.cos(rot);
        ctx.fillStyle = 'rgba(201,162,74,0.4)';
        ctx.fillText(ZODIAC[i], cx+zx, cy+zy);
      }

      // sun corona rays
      const sunR = scale*0.03;
      for(let i=0;i<10;i++){
        const a = (i/10)*Math.PI*2 + t*0.00012;
        const rayLen = sunR * (5 + Math.sin(t*0.001 + i)*1.2);
        const rg = ctx.createLinearGradient(cx,cy, cx+Math.cos(a)*rayLen, cy+Math.sin(a)*rayLen);
        rg.addColorStop(0, 'rgba(238,212,150,0.10)');
        rg.addColorStop(1, 'rgba(238,212,150,0)');
        ctx.strokeStyle = rg; ctx.lineWidth = sunR*0.5;
        ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx+Math.cos(a)*rayLen, cy+Math.sin(a)*rayLen); ctx.stroke();
      }

      // orbit rings + asteroid belt (between Mars and Jupiter, the real location)
      for(const p of planets){
        ctx.beginPath();
        ctx.ellipse(cx, cy, p.a, p.b, rot+p.dTilt, 0, Math.PI*2);
        ctx.strokeStyle = 'rgba(201,162,74,0.2)';
        ctx.lineWidth = 0.9;
        ctx.stroke();
      }
      const beltR = (planets[3].a + planets[4].a) / 2;
      for(let i=0;i<70;i++){
        const bAng = (i/70)*Math.PI*2 + t*0.00018;
        const wobble = (i%7)*scale*0.0012;
        const bx = (beltR+wobble)*Math.cos(bAng)*Math.cos(rot) - (beltR+wobble)*0.34*Math.sin(bAng)*Math.sin(rot);
        const by = (beltR+wobble)*Math.cos(bAng)*Math.sin(rot) + (beltR+wobble)*0.34*Math.sin(bAng)*Math.cos(rot);
        ctx.beginPath(); ctx.arc(cx+bx, cy+by, 1, 0, Math.PI*2);
        ctx.fillStyle = 'rgba(180,170,155,0.35)'; ctx.fill();
      }

      // sun body with limb darkening + glow
      const sunGrad = ctx.createRadialGradient(cx,cy,0,cx,cy,sunR*5);
      sunGrad.addColorStop(0, 'rgba(238,212,150,0.95)');
      sunGrad.addColorStop(0.35, 'rgba(201,162,74,0.55)');
      sunGrad.addColorStop(1, 'rgba(201,162,74,0)');
      ctx.beginPath(); ctx.arc(cx,cy,sunR*5,0,Math.PI*2);
      ctx.fillStyle = sunGrad; ctx.fill();
      const sunBody = ctx.createRadialGradient(cx,cy,0,cx,cy,sunR);
      sunBody.addColorStop(0, 'rgba(255,247,225,1)');
      sunBody.addColorStop(0.65, 'rgba(250,235,195,1)');
      sunBody.addColorStop(1, 'rgba(224,182,120,0.9)');
      ctx.beginPath(); ctx.arc(cx,cy,sunR,0,Math.PI*2);
      ctx.fillStyle = sunBody; ctx.fill();

      // compute live positions once so we can draw aspect lines between them
      const positions = [];
      for(const p of planets){
        const planetRot = rot + p.dTilt;
        let ang = t*p.speed + p.phase;

        // Mercury retrograde loop — a smooth backward bump every ~40s, on-brand detail
        let retroGlow = 0;
        if(p.retro){
          const cyc = 2400, ph = (t % cyc) / cyc;
          if(ph > 0.4 && ph < 0.6){
            const local = (ph-0.4)/0.2;
            ang -= Math.sin(local*Math.PI) * 0.4;
            retroGlow = Math.sin(local*Math.PI);
          }
        }
        const ex = p.a*Math.cos(ang), ey = p.b*Math.sin(ang);
        const px = cx + ex*Math.cos(planetRot) - ey*Math.sin(planetRot);
        const py = cy + ex*Math.sin(planetRot) + ey*Math.cos(planetRot);
        positions.push({p, px, py, ang, planetRot, retroGlow});
      }

      // aspect lines — thin lines between planets currently at a real astrological angle
      const ASPECTS = [0, 60, 90, 120, 180];
      for(let i=0;i<positions.length;i++){
        for(let j=i+1;j<positions.length;j++){
          const diffDeg = Math.abs(((positions[i].ang - positions[j].ang) * 180/Math.PI) % 360);
          const d = Math.min(diffDeg, 360-diffDeg);
          const closest = ASPECTS.reduce((best,a)=> Math.abs(d-a)<Math.abs(best-d)?a:best, 180);
          const delta = Math.abs(d-closest);
          if(delta < 3){
            const alpha = (1 - delta/3) * 0.22;
            ctx.beginPath();
            ctx.moveTo(positions[i].px, positions[i].py);
            ctx.lineTo(positions[j].px, positions[j].py);
            ctx.strokeStyle = 'rgba(201,162,74,'+alpha.toFixed(2)+')';
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }

      for(const {p, px, py, ang, planetRot, retroGlow} of positions){
        const behind = Math.sin(ang) > 0.15;
        const r = scale*p.size;

        ctx.globalAlpha = behind ? 0.5 : 1;

        for(let k=1;k<=7;k++){
          const trailAng = ang - k*0.045;
          const tex = p.a*Math.cos(trailAng), tey = p.b*Math.sin(trailAng);
          const tx = cx + tex*Math.cos(planetRot) - tey*Math.sin(planetRot);
          const ty = cy + tex*Math.sin(planetRot) + tey*Math.cos(planetRot);
          const ta = (1 - k/7) * 0.3 * (behind?0.5:1);
          ctx.beginPath();
          ctx.arc(tx, ty, r*(1 - k*0.09), 0, Math.PI*2);
          ctx.fillStyle = 'rgba('+p.color+','+ta.toFixed(2)+')';
          ctx.fill();
        }

        ctx.beginPath(); ctx.arc(px,py,r,0,Math.PI*2);
        ctx.fillStyle = 'rgba('+p.color+',0.55)';
        ctx.fill();

        const dx = cx-px, dy = cy-py;
        const dist = Math.hypot(dx,dy) || 1;
        const nx = dx/dist, ny = dy/dist;
        ctx.save();
        ctx.beginPath(); ctx.arc(px,py,r,0,Math.PI*2); ctx.clip();
        const lit = ctx.createRadialGradient(px+nx*r*0.5, py+ny*r*0.5, 0, px+nx*r*0.5, py+ny*r*0.5, r*1.4);
        lit.addColorStop(0, 'rgba('+p.color+',1)');
        lit.addColorStop(0.6, 'rgba('+p.color+',0.5)');
        lit.addColorStop(1, 'rgba('+p.color+',0)');
        ctx.fillStyle = lit;
        ctx.fillRect(px-r*1.5, py-r*1.5, r*3, r*3);
        const shadow = ctx.createRadialGradient(px-nx*r*0.6, py-ny*r*0.6, 0, px-nx*r*0.6, py-ny*r*0.6, r*1.3);
        shadow.addColorStop(0, 'rgba(10,8,6,0.45)');
        shadow.addColorStop(1, 'rgba(10,8,6,0)');
        ctx.fillStyle = shadow;
        ctx.fillRect(px-r*1.5, py-r*1.5, r*3, r*3);
        ctx.restore();

        if(p.ring){
          ctx.beginPath();
          ctx.ellipse(px, py, r*2.1, r*0.62, planetRot+0.5, 0, Math.PI*2);
          ctx.strokeStyle = 'rgba(230,205,150,0.55)';
          ctx.lineWidth = r*0.28;
          ctx.stroke();
        }

        const pg = ctx.createRadialGradient(px,py,0,px,py,r*2.4);
        pg.addColorStop(0, 'rgba('+p.color+',0.22)');
        pg.addColorStop(1, 'rgba('+p.color+',0)');
        ctx.beginPath(); ctx.arc(px,py,r*2.4,0,Math.PI*2);
        ctx.fillStyle = pg; ctx.fill();

        // retrograde amber halo — Mercury's signature astrology moment
        if(retroGlow > 0){
          const rg2 = ctx.createRadialGradient(px,py,0,px,py,r*3.2);
          rg2.addColorStop(0, 'rgba(214,150,60,'+(retroGlow*0.5).toFixed(2)+')');
          rg2.addColorStop(1, 'rgba(214,150,60,0)');
          ctx.beginPath(); ctx.arc(px,py,r*3.2,0,Math.PI*2);
          ctx.fillStyle = rg2; ctx.fill();
        }

        if(p.hasMoon){
          const moonAng = t*0.0032;
          const moonOrbit = r*2.8;
          const mx2 = px + moonOrbit*Math.cos(moonAng)*Math.cos(planetRot) - moonOrbit*0.4*Math.sin(moonAng)*Math.sin(planetRot);
          const my2 = py + moonOrbit*Math.cos(moonAng)*Math.sin(planetRot) + moonOrbit*0.4*Math.sin(moonAng)*Math.cos(planetRot);
          ctx.beginPath();
          ctx.ellipse(px, py, moonOrbit, moonOrbit*0.4, planetRot, 0, Math.PI*2);
          ctx.strokeStyle = 'rgba(201,162,74,0.16)';
          ctx.lineWidth = 0.6;
          ctx.stroke();
          ctx.beginPath(); ctx.arc(mx2, my2, r*0.34, 0, Math.PI*2);
          ctx.fillStyle = 'rgba(228,225,217,0.95)';
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    }
  })();

  /* ---- Signature moment: converging chart reveal on onboarding submit ---- */
  function revealChart(){
    const overlay = document.getElementById('cosmicReveal');
    const canvas = document.getElementById('revealCanvas');
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height, cx = W/2, cy = H/2;
    overlay.classList.add('active');
    requestAnimationFrame(()=>overlay.classList.add('show'));

    const N = 60;
    const points = Array.from({length:N}, (_,i)=>({
      startX: Math.random()*W, startY: Math.random()*H,
      angle: (i/N)*Math.PI*2,
      radius: 150 + (i%3)*20
    }));

    const duration = 1600;
    const start = performance.now();

    function ease(x){ return 1 - Math.pow(1-x, 3); }

    function draw(now){
      const p = Math.min(1, (now-start)/duration);
      const e = ease(p);
      ctx.clearRect(0,0,W,H);

      // outer chart ring, fades in
      ctx.strokeStyle = 'rgba(201,162,74,' + (0.5*e).toFixed(2) + ')';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, 150, 0, Math.PI*2); ctx.stroke();

      // 12 house divider lines
      for(let i=0;i<12;i++){
        const a = (i/12)*Math.PI*2;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a)*40, cy + Math.sin(a)*40);
        ctx.lineTo(cx + Math.cos(a)*150, cy + Math.sin(a)*150);
        ctx.strokeStyle = 'rgba(201,162,74,' + (0.18*e).toFixed(2) + ')';
        ctx.stroke();
      }

      // converging points settle onto the ring
      for(const pt of points){
        const targetX = cx + Math.cos(pt.angle) * pt.radius;
        const targetY = cy + Math.sin(pt.angle) * pt.radius;
        const x = pt.startX + (targetX - pt.startX) * e;
        const y = pt.startY + (targetY - pt.startY) * e;
        ctx.beginPath();
        ctx.arc(x, y, 1.6, 0, Math.PI*2);
        ctx.fillStyle = 'rgba(242,237,226,' + (0.25 + 0.55*e).toFixed(2) + ')';
        ctx.fill();
      }

      // center glow
      const grad = ctx.createRadialGradient(cx,cy,0,cx,cy,60);
      grad.addColorStop(0, 'rgba(201,162,74,' + (0.35*e).toFixed(2) + ')');
      grad.addColorStop(1, 'rgba(201,162,74,0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(cx,cy,60,0,Math.PI*2); ctx.fill();

      if(p < 1){
        requestAnimationFrame(draw);
      } else {
        document.getElementById('revealText').textContent = 'Your chart is ready';
        setTimeout(()=>{
          overlay.classList.remove('show');
          setTimeout(()=>{
            overlay.classList.remove('active');
            showScreen('dashboard');
          }, 500);
        }, 700);
      }
    }
    requestAnimationFrame(draw);
  }

  /* ---- Topic wall: sample-reading preview ---- */
  function openTopicPreview(tile){
    document.getElementById('tpTitle').textContent = tile.dataset.title;
    document.getElementById('tpSample').textContent = tile.dataset.sample;
    document.getElementById('topicPreview').classList.add('active');
  }
  function closeTopicPreview(){
    document.getElementById('topicPreview').classList.remove('active');
  }

  /* ---- Curve the topic wall into a true cylindrical arc (landing page only) ---- */
  (function curvedGallery(){
    const gallery = document.getElementById('topicGallery');
    if(!gallery) return;
    const tiles = Array.from(gallery.children);
    const center = (tiles.length - 1) / 2;
    const angleStep = 15;      // degrees between each tile — bigger = more curved
    const radius = 480;        // cylinder radius — smaller = tighter, more dramatic curve
    let sway = 0;

    function layout(){
      const wrapW = gallery.parentElement.clientWidth;
      const centerX = wrapW / 2;
      tiles.forEach((tile, i)=>{
        const offset = i - center;
        const theta = offset * angleStep;
        const rad = theta * Math.PI / 180;
        const x = radius * Math.sin(rad);
        const z = -radius * (1 - Math.cos(rad));
        const y = Math.pow(Math.abs(offset), 2) * 3;
        tile.style.left = (centerX + x - 74) + 'px';
        tile.style.top = y + 'px';
        tile.dataset.theta = (-theta).toFixed(2);
        tile.dataset.z = z.toFixed(1);
      });
      render();
    }

    function render(){
      gallery.style.transform = 'rotateX(6deg) rotateY(' + sway.toFixed(2) + 'deg)';
      tiles.forEach(tile=>{
        tile.style.transform = 'rotateY(' + tile.dataset.theta + 'deg) translateZ(' + tile.dataset.z + 'px)';
      });
    }

    layout();
    window.addEventListener('resize', layout);
    window.addEventListener('mousemove', e=>{
      const rect = gallery.getBoundingClientRect();
      const rel = (e.clientX - (rect.left + rect.width/2)) / (rect.width/2 || 1);
      sway = Math.max(-1, Math.min(1, rel)) * -6;
      render();
    });
  })();