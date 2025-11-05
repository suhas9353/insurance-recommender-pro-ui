/* Canvas particle background (JS) */
const canvas = document.getElementById('bg-canvas');
const dpr = window.devicePixelRatio || 1;
let ctx, W, H, particles = [];
function resizeCanvas(){
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  ctx = canvas.getContext('2d');
  ctx.scale(dpr,dpr);
  W = window.innerWidth; H = window.innerHeight;
}
function rand(min,max){return Math.random()*(max-min)+min;}
function initParticles(count=28){
  particles = [];
  for(let i=0;i<count;i++){particles.push({
    x: rand(0,W), y: rand(0,H),
    r: rand(20,80), vx: rand(-0.15,0.15), vy: rand(-0.05,0.05),
    hue: rand(200,230), alpha: rand(0.06,0.18)
  });}
}
function drawBg(t){
  ctx.clearRect(0,0,W,H);
  // animated gradient background
  let g = ctx.createLinearGradient(0,0,W,H);
  let a = Math.sin(t/6000)*0.5 + 0.5;
  g.addColorStop(0, 'rgba(14,165,164,'+(0.12+a*0.08)+')');
  g.addColorStop(0.5, 'rgba(37,99,235,'+(0.08+a*0.06)+')');
  g.addColorStop(1, 'rgba(99,102,241,'+(0.08+a*0.06)+')');
  ctx.fillStyle = g;
  ctx.fillRect(0,0,W,H);
  // draw particles
  particles.forEach(p=>{
    p.x += p.vx; p.y += p.vy;
    if(p.x < -100) p.x = W+100;
    if(p.x > W+100) p.x = -100;
    if(p.y < -100) p.y = H+100;
    if(p.y > H+100) p.y = -100;
    let grad = ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r);
    grad.addColorStop(0, 'hsla('+p.hue+',90%,'+'55%,'+p.alpha+')');
    grad.addColorStop(1, 'hsla('+p.hue+',90%,'+'45%,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
    ctx.fill();
  });
}
let lastT = 0;
function animate(t){
  drawBg(t);
  lastT = t;
  requestAnimationFrame(animate);
}
window.addEventListener('resize', ()=>{ resizeCanvas(); initParticles(Math.max(14, Math.floor(window.innerWidth/80))); });
resizeCanvas(); initParticles(Math.max(14, Math.floor(window.innerWidth/80))); requestAnimationFrame(animate);

/* Theme toggle + system-aware */
const themeToggle = document.getElementById('theme-toggle');
function applyTheme(mode){ // mode: 'dark'|'light'|'auto'
  if(mode==='auto'){
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', mode);
  }
}
themeToggle.addEventListener('click', ()=>{
  const cur = document.documentElement.getAttribute('data-theme');
  if(cur==='dark') applyTheme('light'); else applyTheme('dark');
});

/* Helper to create card element */
function createCard(p){
  const card = document.createElement('div');
  card.className = 'policy-card';
  const left = document.createElement('div'); left.className='policy-left';
  left.innerHTML = `<div class="brand">${p.brand} <span class="suitability">${p.suitability||''}</span></div>
    <div class="policy-name">${p.policy}</div>
    <div class="remarks">${p.remarks}</div>
    <div class="coverage">${p.coverage}</div>
    <a class="view-btn" href="${p.url||'https://www.policybazaar.com/health-insurance/'}" target="_blank">🔗 View </a>`;
  const right = document.createElement('div'); right.className='policy-right';
  right.innerHTML = `<div class="price">₹ ${p.price.toLocaleString()}</div>`;
  const bar = document.createElement('div'); bar.className='suit-bar';
  const fill = document.createElement('div'); fill.className='suit-fill';
  bar.appendChild(fill);
  const label = document.createElement('div'); label.className='suit-label';
  label.innerHTML = `<span class="label-text">Suitability</span><span class="label-score">${p.suitability||''}</span>`;
  card.appendChild(left); card.appendChild(right); card.appendChild(bar); card.appendChild(label);

  // set bar based on suitability text
  let pct = 0, color = 'linear-gradient(90deg,#ff6b6b,#ffd166,#6ee7b7)';
  const s = (p.suitability||'').toLowerCase();
  if(s.includes('high')){ pct = 100; color = 'linear-gradient(90deg,#6ee7b7,#10b981)'; }
  else if(s.includes('good')){ pct = 66; color = 'linear-gradient(90deg,#ffd166,#f59e0b)'; }
  else { pct = 32; color = 'linear-gradient(90deg,#ff6b6b,#ff8a6b)'; }
  // animate fill
  setTimeout(()=>{ fill.style.width = pct + '%'; fill.style.background = color; card.classList.add('show'); }, 80);

  return card;
}

/* Fetch recommendations and render */
const form = document.getElementById('predict-form');
const cardsDiv = document.getElementById('cards');
const moreCardsDiv = document.getElementById('more-cards');
const showMoreBtn = document.getElementById('show-more');
const moreSection = document.getElementById('more-section');
const riskDiv = document.getElementById('risk');

form.addEventListener('submit', async (e)=>{
  e.preventDefault();
  cardsDiv.innerHTML = '<div class="hint">Searching recommendations...</div>';
  moreCardsDiv.innerHTML = ''; moreSection.style.display='none'; showMoreBtn.style.display='none'; riskDiv.textContent='Risk: N/A';
  const payload = {
    Age: document.getElementById('Age').value,
    Diabetes: document.getElementById('Diabetes').value,
    BloodPressureProblems: document.getElementById('BloodPressureProblems').value,
    AnyTransplants: document.getElementById('AnyTransplants').value,
    AnyChronicDiseases: document.getElementById('AnyChronicDiseases').value,
    Height: document.getElementById('Height').value,
    Weight: document.getElementById('Weight').value,
    KnownAllergies: document.getElementById('KnownAllergies').value,
    HistoryOfCancerInFamily: document.getElementById('HistoryOfCancerInFamily').value,
    NumberOfMajorSurgeries: document.getElementById('NumberOfMajorSurgeries').value,
    budget: document.getElementById('budget').value
  };
  try{
    const res = await fetch('/predict', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
    const data = await res.json();
    if(!res.ok){ cardsDiv.innerHTML = '<b>Error:</b> ' + (data.error || 'Unknown'); return; }
    riskDiv.textContent = 'Risk: ' + (data.risk_score || 'N/A');
    cardsDiv.innerHTML = '';
    (data.recommendations || []).forEach(p => cardsDiv.appendChild(createCard(p)));
    if((data.more_recommendations||[]).length>0){
      showMoreBtn.style.display='inline-block'; moreSection.style.display='none'; moreCardsDiv.innerHTML='';
      data.more_recommendations.forEach(p => moreCardsDiv.appendChild(createCard(p)));
      showMoreBtn.onclick = ()=>{
        if(moreSection.style.display==='none'){ moreSection.style.display='block'; showMoreBtn.textContent='Hide More Policies'; }
        else { moreSection.style.display='none'; showMoreBtn.textContent='Show More Policies'; }
      }
    } else { showMoreBtn.style.display='none'; }
  }catch(err){
    cardsDiv.innerHTML = '<b>Network error:</b> ' + err.message;
  }
});

// small accessibility: press Enter triggers form
document.addEventListener('keydown', (e)=>{ if(e.key==='Enter' && document.activeElement.tagName !== 'TEXTAREA') { /* let form handle it */ } });
