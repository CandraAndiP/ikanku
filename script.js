// Akuarium Realistis - Update UI: hapus tombol tambah/kurangi ikan, + / - jadi kontrol utama
// Script menyesuaikan: tidak ada referensi ke tombol yang dihapus

const canvasBg = document.getElementById('canvas-bg');
const canvasMain = document.getElementById('canvas-main');
const canvasRipples = document.getElementById('canvas-ripples');
const ctxBg = canvasBg.getContext('2d', { alpha: true });
const ctx = canvasMain.getContext('2d', { alpha: true });
const ctxR = canvasRipples.getContext('2d', { alpha: true });

const addFoodBtn = document.getElementById('addFoodBtn');
const toggleBubblesBtn = document.getElementById('toggleBubbles');
const fishRange = document.getElementById('fishCount');
const fishRangeOut = document.getElementById('fishCountOut');
const fishMinus = document.getElementById('fishMinus');
const fishPlus = document.getElementById('fishPlus');
const fishCountDisplay = document.getElementById('fishCountDisplay');

let W = 0, H = 0;
let devicePR = Math.max(1, window.devicePixelRatio || 1);
let isMobile = /Mobi|Android/i.test(navigator.userAgent) || window.innerWidth < 700;
let DPR_CAP = isMobile ? 1.5 : 2;
let DPR = Math.min(devicePR, DPR_CAP);
let resizeTimeout = null;
function resize() {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    W = window.innerWidth; H = window.innerHeight;
    isMobile = /Mobi|Android/i.test(navigator.userAgent) || W < 700;
    DPR_CAP = isMobile ? 1.5 : 2;
    DPR = Math.min(window.devicePixelRatio || 1, DPR_CAP);
    [canvasBg, canvasMain, canvasRipples].forEach(c => {
      c.width = Math.max(1, Math.floor(W * DPR));
      c.height = Math.max(1, Math.floor(H * DPR));
      c.style.width = W + 'px';
      c.style.height = H + 'px';
      const cc = c.getContext('2d');
      cc.setTransform(DPR,0,0,DPR,0,0);
    });
  }, 80);
}
window.addEventListener('resize', resize);
resize();

// Settings & utilities
let BUBBLES_ON = true;
let CAUSTICS = true;
let running = true;
const rand = (a,b) => Math.random()*(b-a)+a;
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
const dist = (a,b,c,d) => Math.hypot(a-c, b-d);

// Simulation lists & caps
let fishes = [];
let bubbles = [];
let foods = [];
let ripples = [];
let last = performance.now();
const MAX_FISH = 40;

// Species/colors (unchanged)
const SPECIES = [
  { body:'#ffb37a', accent:'#ff7a4d', size:1.0, speed:1.0 },
  { body:'#7fd3ff', accent:'#3faeea', size:0.9, speed:1.05 },
  { body:'#ffd97a', accent:'#d89d3c', size:1.2, speed:0.9 },
  { body:'#b69bff', accent:'#7b5cff', size:1.1, speed:1.1 },
  { body:'#8effa6', accent:'#3ecf7a', size:0.85, speed:1.2 },
];

// Fish, Bubble, Food, Ripple classes... (sama seperti sebelumnya)
// For brevity I'll reuse the same classes as before (copy-paste from previous version).
// --- Fish class ---
class Fish {
  constructor(x,y, species=null){
    this.pos = { x: x ?? rand(0, W), y: y ?? rand(50, H-150) };
    this.vel = { x: rand(-40,40), y: rand(-8,8) };
    this.acc = { x:0, y:0 };
    this.size = rand(0.8, 1.2);
    this.spec = species ?? SPECIES[Math.floor(Math.random()*SPECIES.length)];
    this.size *= this.spec.size;
    this.speed = 40 * this.spec.speed * (0.8 + Math.random()*0.6);
    this.maxForce = 40;
    this.wagPhase = Math.random()*Math.PI*2;
    this.wagSpeed = rand(6,10);
    this.targetFood = null;
    this.depth = rand(0.25, 1.0);
    this.age = 0;
    this.id = Math.random().toString(36).slice(2,9);
  }

  applyForce(fx, fy){ this.acc.x += fx; this.acc.y += fy; }

  update(dt){
    this.age += dt;
    let steerX=0, steerY=0;
    if (this.targetFood && !this.targetFood.eaten) {
      const dx = this.targetFood.x - this.pos.x;
      const dy = this.targetFood.y - this.pos.y;
      const d = Math.hypot(dx,dy);
      if (d < 14) {
        this.targetFood.eaten = true;
        spawnBubble(this.pos.x + rand(-6,6), this.pos.y + rand(-6,6), 6, this.depth);
        this.targetFood = null;
      } else {
        const nx = dx / d, ny = dy / d;
        steerX += nx * this.speed * 1.8;
        steerY += ny * this.speed * 1.8;
      }
    } else {
      let baseRadius = Math.max(40, Math.min(90, W * 0.08));
      let neighRadius = baseRadius * (0.9 + this.depth * 1.1);
      let sepX=0, sepY=0, aliX=0, aliY=0, cohX=0, cohY=0;
      let count=0;
      for (let other of fishes) {
        if (other === this) continue;
        const d = dist(this.pos.x,this.pos.y, other.pos.x, other.pos.y);
        if (d < neighRadius) {
          const diffx = this.pos.x - other.pos.x;
          const diffy = this.pos.y - other.pos.y;
          const inv = d > 0 ? 1 / d : 0;
          sepX += diffx * inv;
          sepY += diffy * inv;
          aliX += other.vel.x; aliY += other.vel.y;
          cohX += other.pos.x; cohY += other.pos.y;
          count++;
        }
      }
      if (count > 0){
        sepX /= count; sepY /= count;
        aliX /= count; aliY /= count;
        cohX = (cohX / count - this.pos.x);
        cohY = (cohY / count - this.pos.y);
        steerX += sepX * 120 + aliX * 0.75 + cohX * 0.6;
        steerY += sepY * 120 + aliY * 0.75 + cohY * 0.6;
      }
      steerX += Math.cos(this.age*0.4 + this.wagPhase)*8;
      steerY += Math.sin(this.age*0.6 + this.wagPhase)*6;
    }

    const margin = 60;
    if (this.pos.x < margin) steerX += (margin - this.pos.x) * 3;
    if (this.pos.x > W - margin) steerX -= (this.pos.x - (W - margin)) * 3;
    if (this.pos.y < 30) steerY += (30 - this.pos.y) * 4;
    if (this.pos.y > H - 120) steerY -= (this.pos.y - (H - 120)) * 4;

    const fmag = Math.hypot(steerX, steerY);
    if (fmag > this.maxForce) {
      steerX = (steerX / fmag) * this.maxForce;
      steerY = (steerY / fmag) * this.maxForce;
    }
    this.applyForce(steerX, steerY);

    this.vel.x += this.acc.x * dt;
    this.vel.y += this.acc.y * dt;
    const vmag = Math.hypot(this.vel.x, this.vel.y);
    const maxSp = this.speed * (0.6 + this.depth*1.4);
    if (vmag > maxSp) {
      this.vel.x = (this.vel.x / vmag) * maxSp;
      this.vel.y = (this.vel.y / vmag) * maxSp;
    }
    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;
    this.acc.x = 0; this.acc.y = 0;

    if (this.pos.x < -120) this.pos.x = W + 60;
    if (this.pos.x > W + 120) this.pos.x = -60;
  }

  draw(ctx){
    const d = this.depth;
    const scale = this.size * (0.6 + d*0.9);
    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    const angle = Math.atan2(this.vel.y, this.vel.x);
    ctx.rotate(angle);

    const g = ctx.createLinearGradient(-20*scale,0,20*scale,0);
    g.addColorStop(0, this.spec.body);
    g.addColorStop(1, this.spec.accent);
    ctx.fillStyle = g;
    ctx.globalAlpha = clamp(0.6 + d*0.6, 0.5, 1.0);

    const speed = Math.hypot(this.vel.x, this.vel.y);
    const wag = Math.sin(this.age * this.wagSpeed) * 6 * (speed / (this.speed+1));

    ctx.beginPath();
    ctx.ellipse(0, 0, 22*scale, 12*scale, 0, 0, Math.PI*2);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(-20*scale, 0);
    ctx.lineTo(-32*scale + wag, -10*scale);
    ctx.lineTo(-32*scale - wag, 10*scale);
    ctx.closePath();
    ctx.fillStyle = this.spec.accent;
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = '#fff';
    ctx.arc(8*scale, -4*scale, 3*scale, 0, Math.PI*2);
    ctx.fill();
    ctx.beginPath();
    ctx.fillStyle = '#000';
    ctx.arc(8*scale+1*scale, -4*scale, 1.4*scale, 0, Math.PI*2);
    ctx.fill();

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  setTarget(food) { this.targetFood = food; }
}

// Bubble, Food, Ripple (sama seperti sebelumnya)
class Bubble {
  constructor(x,y,size=8, depth=0.8){
    this.x = x; this.y = y; this.r = size; this.depth = depth;
    this.vy = rand(-10, -60) * (0.6 + (1-depth));
    this.vx = rand(-6,6);
    this.alpha = rand(0.5, 0.95);
    this.age = 0;
  }
  update(dt){
    this.age += dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.r *= 1 + dt*0.02;
    if (this.y < -40) this.dead = true;
  }
  draw(ctx){
    ctx.save();
    ctx.globalAlpha = this.alpha * (0.5 + this.depth*0.8);
    const grad = ctx.createRadialGradient(this.x- this.r*0.3, this.y - this.r*0.3, this.r*0.1, this.x, this.y, this.r);
    grad.addColorStop(0, 'rgba(255,255,255,0.95)');
    grad.addColorStop(0.3, 'rgba(255,255,255,0.6)');
    grad.addColorStop(1, 'rgba(255,255,255,0.02)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI*2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(200,230,255,0.2)';
    ctx.lineWidth = Math.max(1, this.r*0.06);
    ctx.stroke();
    ctx.restore();
  }
}

class Food {
  constructor(x,y, vx = 0){
    this.x = x; this.y = y;
    const baseSlow = isMobile ? rand(8,20) : rand(12,28);
    this.vy = baseSlow;
    this.vx = vx + rand(-8, 8);
    this.wob = rand(0.6, 1.4);
    this.eaten = false;
    this.age = 0;
  }
  update(dt){
    this.age += dt;
    if (this.eaten) return;
    this.x += this.vx * dt + Math.sin(this.age * 6) * (0.3 * this.wob);
    this.y += this.vy * dt;
    this.vx *= 0.995;
    if (this.y > H - 80) {
      this.y = H - 80;
      this.vy = 0;
      this.vx = 0;
    }
  }
  draw(ctx){
    ctx.save();
    ctx.fillStyle = '#7b4528';
    ctx.beginPath();
    ctx.ellipse(this.x, this.y, 4, 4.5, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.ellipse(this.x-1, this.y-1, 1.1, 1.1, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }
}

class Ripple {
  constructor(x,y){
    this.x = x; this.y = y; this.t=0; this.max=1000; this.alive=true;
  }
  update(dt){
    this.t += dt*1000;
    if (this.t > this.max) this.alive=false;
  }
  draw(ctx){
    const life = this.t / this.max;
    if (life > 1) return;
    ctx.save();
    ctx.globalAlpha = (1-life) * 0.45;
    ctx.strokeStyle = `rgba(255,255,255,${0.12*(1-life)})`;
    ctx.lineWidth = 2*(1-life);
    const radius = life * 160;
    ctx.beginPath();
    ctx.arc(this.x, this.y, radius, 0, Math.PI*2);
    ctx.stroke();
    ctx.restore();
  }
}

// spawn helpers
function spawnFish(n=1){
  const allowed = Math.max(0, Math.min(n, MAX_FISH - fishes.length));
  for (let i=0;i<allowed;i++){
    const f = new Fish(rand(80, W-80), rand(60, H-200));
    fishes.push(f);
  }
}
function spawnBubble(x, y, size=10, depth=0.8){
  if (!BUBBLES_ON) return;
  if (bubbles.length > (isMobile ? 80 : 180)) return;
  const b = new Bubble(x, y, size, depth);
  bubbles.push(b);
}
function spawnBubbleCluster(x, y, count=6){
  for (let i=0;i<count;i++){
    setTimeout(() => spawnBubble(x+rand(-20,20), y+rand(-10,10), rand(6, 18), rand(0.3, 1.0)), i*80);
  }
}
function dropFood(x,y, vx = 0){
  if (foods.length >= (isMobile ? 8 : 18)) return;
  const f = new Food(x, y - 8, vx);
  foods.push(f);
  spawnBubbleCluster(x, y, 4);
}

// add-food button action
function addFoodButtonAction(){
  const count = isMobile ? (3 + Math.floor(rand(0,3))) : (4 + Math.floor(rand(2,6)));
  for (let i=0;i<count;i++){
    const x = clamp(rand(20, W-20) + (Math.random() < 0.35 ? rand(-80,80) : 0), 20, W-20);
    const y = clamp(rand(H*0.06, H*0.18) + rand(-8,8), 12, H*0.25);
    const vx = rand(-18, 18);
    setTimeout(() => dropFood(x + rand(-16,16), y + rand(-6,6), vx), i * (isMobile ? 160 : 120));
  }
}

// caustics (simplified on mobile)
let causticOffset = 0;
function drawCaustics(ctx, dt){
  if (!CAUSTICS) return;
  causticOffset += dt * 0.06;
  ctx.clearRect(0,0,W,H);
  const bandCount = isMobile ? 4 : 8;
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  for (let i=0;i<bandCount;i++){
    const yAmp = (isMobile ? 24 : 40) + (isMobile ? 12 : 20)*Math.sin(causticOffset + i);
    ctx.beginPath();
    const base = (i / bandCount) * H;
    for (let x=0;x<=W;x+= isMobile ? 18 : 10){
      const y = base + Math.sin((x*(isMobile?0.01:0.02)) + causticOffset*1.4 + i) * yAmp;
      if (x===0) ctx.moveTo(x,y);
      else ctx.lineTo(x,y);
    }
    const grad = ctx.createLinearGradient(0, base-80, 0, base+80);
    grad.addColorStop(0, 'rgba(255,255,255,0.02)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.05)');
    grad.addColorStop(1, 'rgba(255,255,255,0.01)');
    ctx.strokeStyle = grad;
    ctx.lineWidth = (isMobile ? 36 : 60) * (0.6 + (i/bandCount)*0.4);
    ctx.stroke();
  }
  ctx.restore();
  ctx.save();
  const g = ctx.createRadialGradient(W/2, H*0.2, 100, W/2, H/2, Math.max(W,H));
  g.addColorStop(0, 'rgba(255,255,255,0.02)');
  g.addColorStop(1, 'rgba(0,0,0,0.2)');
  ctx.fillStyle = g;
  ctx.fillRect(0,0,W,H);
  ctx.restore();
}

// pause when document hidden
document.addEventListener('visibilitychange', () => {
  running = !document.hidden;
  if (!running) return;
  last = performance.now();
  requestAnimationFrame(step);
});

// main loop (sama seperti sebelumnya)
function step(now){
  if (!running) {
    requestAnimationFrame(step);
    return;
  }
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  drawCaustics(ctxBg, dt);

  for (const fish of fishes) {
    if (fish.targetFood && fish.targetFood.eaten) fish.targetFood = null;
  }
  for (const food of foods) {
    if (food.eaten) continue;
    let nearest = null, nd = Infinity;
    for (const fish of fishes) {
      if (fish.targetFood) continue;
      const d = dist(fish.pos.x, fish.pos.y, food.x, food.y);
      if (d < nd) { nd = d; nearest = fish; }
    }
    if (nearest && nd < 900) nearest.setTarget(food);
  }

  fishes.forEach(f => f.update(dt));
  bubbles.forEach(b => b.update(dt));
  foods.forEach(f => f.update(dt));
  ripples.forEach(r => r.update(dt));

  if (bubbles.length > (isMobile ? 80 : 180)) bubbles.splice(0, bubbles.length - (isMobile ? 80 : 180));
  if (foods.length > (isMobile ? 10 : 20)) foods.splice(0, foods.length - (isMobile ? 10 : 20));
  bubbles = bubbles.filter(b => !b.dead);
  foods = foods.filter(f => !f.eaten);
  ripples = ripples.filter(r => r.alive);

  ctx.clearRect(0,0,W,H);

  ctx.save();
  const fog = ctx.createLinearGradient(0,0,0,H);
  fog.addColorStop(0, 'rgba(255,255,255,0.02)');
  fog.addColorStop(1, 'rgba(0,0,0,0.06)');
  ctx.fillStyle = fog;
  ctx.fillRect(0,0,W,H);
  ctx.restore();

  fishes.sort((a,b) => a.depth - b.depth);

  bubbles.filter(b => b.depth < 0.6).forEach(b => b.draw(ctx));
  fishes.forEach(f => f.draw(ctx));
  foods.forEach(f => f.draw(ctx));
  bubbles.filter(b => b.depth >= 0.6).forEach(b => b.draw(ctx));

  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  fishes.forEach(f => {
    const r = 24 * f.size * (0.7 + f.depth);
    const g = ctx.createRadialGradient(f.pos.x, f.pos.y, 0, f.pos.x, f.pos.y, r*2);
    g.addColorStop(0, 'rgba(255,255,255,0.03)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(f.pos.x - r*2, f.pos.y - r*2, r*4, r*4);
  });
  ctx.restore();

  ctxR.clearRect(0,0,W,H);
  ripples.forEach(r => r.draw(ctxR));

  requestAnimationFrame(step);
}

// Interaction: touch & click support
const aquarium = document.getElementById('aquarium');
function handlePointerDrop(x, y) {
  dropFood(x + rand(-6,6), y - 6 + rand(-6,6), rand(-12,12));
  ripples.push(new Ripple(x, y));
}
aquarium.addEventListener('click', (e) => {
  const rect = aquarium.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  handlePointerDrop(x, y);
});
aquarium.addEventListener('touchstart', (ev) => {
  if (!ev.touches || ev.touches.length === 0) return;
  const t = ev.touches[0];
  const rect = aquarium.getBoundingClientRect();
  const x = t.clientX - rect.left;
  const y = t.clientY - rect.top;
  handlePointerDrop(x, y);
}, { passive: true });

// UI wiring (without add/remove buttons)
if (fishRange) {
  fishRange.addEventListener('input', () => {
    const val = parseInt(fishRange.value,10);
    const current = fishes.length;
    const diff = val - current;
    if (diff > 0) spawnFish(diff);
    else if (diff < 0) fishes.splice(diff);
    fishRangeOut.value = val;
    updateFishCountDisplay();
  });
}

fishMinus.addEventListener('click', () => {
  const cur = Math.max(1, parseInt(fishRange.value || 1,10));
  if (cur <= 1) return;
  fishRange.value = cur - 1;
  updateFishCountDisplay();
});
fishPlus.addEventListener('click', () => {
  const cur = Math.min(MAX_FISH, parseInt(fishRange.value || 1,10));
  if (cur >= MAX_FISH) return;
  fishRange.value = cur + 1;
  updateFishCountDisplay();
});

function updateFishCountDisplay(){
  const val = parseInt(fishRange.value || 1, 10);
  fishCountDisplay.textContent = String(val);
  // ensure fishes count matches value
  const diff = val - fishes.length;
  if (diff > 0) spawnFish(diff);
  else if (diff < 0) fishes.splice(diff);
}

// Add-food button
addFoodBtn.addEventListener('click', () => addFoodButtonAction());

// toggle bubbles
toggleBubblesBtn.addEventListener('click', () => {
  BUBBLES_ON = !BUBBLES_ON;
  toggleBubblesBtn.textContent = `Gelembung: ${BUBBLES_ON ? 'On' : 'Off'}`;
});

// bubble columns
setInterval(() => {
  if (!BUBBLES_ON) return;
  const x = rand(30, W-30);
  const cluster = Math.floor(rand(isMobile ? 2 : 3, isMobile ? 5 : 8));
  spawnBubbleCluster(x, H-80, cluster);
}, 1400 + Math.random()*1200);

// init
function init(){
  const defaultCount = isMobile ? 6 : (parseInt(fishRange.value,10) || 12);
  fishRange.value = defaultCount;
  if (fishRangeOut) fishRangeOut.value = defaultCount;
  fishCountDisplay.textContent = String(defaultCount);
  spawnFish(defaultCount);

  const initialBubbles = isMobile ? 12 : 30;
  for (let i=0;i<initialBubbles;i++){
    spawnBubble(rand(0,W), rand(H-60, H), rand(4, 18), rand(0.3, 1.0));
  }
  last = performance.now();
  requestAnimationFrame(step);
}
init();

// orientation resize
window.addEventListener('orientationchange', () => {
  setTimeout(resize, 200);
});