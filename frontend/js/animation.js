/* QuickGrade — Animation */

// ── Mouse-reactive dash particles (Antigravity style) ──
  window.addEventListener('load', function initCanvas() {
    const canvas = document.getElementById('hero-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let W, H;
    let mx = -9999, my = -9999;

    const COLORS = [
      '#00e5b8','#00e5b8','#00e5b8',
      '#4f8ef7','#4f8ef7',
      '#a78bfa',
      '#ffffff','#ffffff',
      '#00bfff',
    ];

    const COUNT = 200;
    let dashes = [];
    function rnd(a,b){ return a + Math.random()*(b-a); }

    class Dash {
      constructor(){ this.spawn(); }
      spawn(){
        this.hx = rnd(0,W);
        this.hy = rnd(0,H);
        this.x  = this.hx;
        this.y  = this.hy;
        this.vx = 0; this.vy = 0;
        this.len   = rnd(5, 14);
        this.thick = rnd(1.5, 3);
        this.angle = rnd(0, Math.PI);
        this.color = COLORS[Math.floor(Math.random()*COLORS.length)];
        this.alpha = rnd(0.4, 0.85);
        this.friction = rnd(0.88, 0.94);
        this.springK  = rnd(0.04, 0.08);
      }
      update(){
        const dx = this.x - mx, dy = this.y - my;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const R = 130;
        if(dist < R && dist > 1){
          const f = ((R-dist)/R) * ((R-dist)/R);
          this.vx += (dx/dist) * f * 16;
          this.vy += (dy/dist) * f * 16;
        }
        this.vx += (this.hx - this.x) * this.springK;
        this.vy += (this.hy - this.y) * this.springK;
        this.vx *= this.friction;
        this.vy *= this.friction;
        this.x  += this.vx;
        this.y  += this.vy;
      }
      draw(){
        const half = this.len/2;
        const cos = Math.cos(this.angle), sin = Math.sin(this.angle);
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.strokeStyle = this.color;
        ctx.lineWidth   = this.thick;
        ctx.lineCap     = 'round';
        ctx.beginPath();
        ctx.moveTo(this.x - cos*half, this.y - sin*half);
        ctx.lineTo(this.x + cos*half, this.y + sin*half);
        ctx.stroke();
        ctx.restore();
      }
    }

    function resize(){
      // Use offsetWidth first, fallback to window dimensions (fixes VS Code Live Server)
      W = canvas.width  = window.innerWidth;
      H = canvas.height = window.innerHeight;
    }
    function init(){
      dashes = [];
      for(let i=0;i<COUNT;i++) dashes.push(new Dash());
    }
    function loop(){
      ctx.clearRect(0,0,W,H);
      dashes.forEach(d=>{ d.update(); d.draw(); });
      requestAnimationFrame(loop);
    }

    resize(); init(); loop();
    window.addEventListener('resize', ()=>{ resize(); init(); });

    // Listen on both document and landing element for max compatibility
    function onMove(e){
      const r = canvas.getBoundingClientRect();
      mx = e.clientX - r.left;
      my = e.clientY - r.top;
    }
    function onLeave(){ mx = -9999; my = -9999; }

    window.addEventListener('mousemove', function(e){
      if(document.getElementById('landing')?.classList.contains('active')){
        mx = e.clientX; my = e.clientY;
      } else { mx = -9999; my = -9999; }
    });
  });
