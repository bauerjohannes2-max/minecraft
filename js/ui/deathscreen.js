/* ============================================================
   VOXELCRAFT — deathscreen.js
   Red overlay + "You Died!" + respawn button.
   Respawn = reset player at world spawn with fresh vitals.
   ============================================================ */

export class DeathScreen {
  constructor(player, onResume) {
    this.player = player;
    this.el = document.getElementById('death-screen');
    document.getElementById('btn-respawn')?.addEventListener('click', () => {
      this.el?.classList.add('hidden');
      this.player.health = this.player.maxHealth ?? 20;
      this.player.hunger = 20;
      this.player.vel.set(0, 0, 0);
      onResume?.();
    });
  }

  update() {
    if (this.player.health <= 0 && this.el && this.el.classList.contains('hidden')) {
      const cause = document.getElementById('death-cause');
      if (cause) cause.textContent = 'The world claims another builder…';
      this.el.classList.remove('hidden');
    }
  }
}
