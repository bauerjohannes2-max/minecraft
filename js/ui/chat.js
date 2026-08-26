/* ============================================================
   VOXELCRAFT — chat.js
   T-to-open chat interface, command & text sender, auto-fading log
   ============================================================ */

export class Chat {
  constructor(controls) {
    this.el = document.getElementById('chat');
    this.input = document.getElementById('chat-input');
    this.log = document.getElementById('chat-log');
    this.controls = controls;
    this.open = false;

    this.input?.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        const msg = this.input.value.trim();
        if (msg) {
          if (window.G?.net?.connected) {
            window.G.net.send({ t: 'chat', msg, name: window.G.net.name });
          } else {
            this.addLine(`<Me> ${msg}`);
          }
        }
        this.close();
      }
      if (e.key === 'Escape') {
        this.close();
      }
    });
  }

  openChat() {
    this.open = true;
    this.el?.classList.remove('hidden');
    this.controls?.setUIOpen(true);
    setTimeout(() => this.input?.focus(), 20);
  }

  close() {
    this.open = false;
    if (this.input) this.input.value = '';
    this.el?.classList.add('hidden');
    this.controls?.setUIOpen(false);
    this.controls?.requestLock();
  }

  addLine(text) {
    if (!this.log) return;
    const d = document.createElement('div');
    d.className = 'chat-line';
    d.textContent = text;
    this.log.appendChild(d);
    setTimeout(() => {
      d.style.opacity = '0';
      setTimeout(() => d.remove(), 600);
    }, 10000);
  }
}
