import type { InputState } from './types';

type Action = 'gas' | 'brake' | 'leanFwd' | 'leanBack';
type Listener = (e: KeyboardEvent) => void;

export class Input {
  state: InputState = { gas: false, brake: false, leanFwd: false, leanBack: false };
  private onRestart?: () => void;
  private onMenu?: () => void;
  private kd: Listener;
  private ku: Listener;
  private touchUnsub: Array<() => void> = [];

  constructor(opts: { onRestart?: () => void; onMenu?: () => void }) {
    this.onRestart = opts.onRestart;
    this.onMenu = opts.onMenu;

    this.kd = (e: KeyboardEvent) => this.handleKey(e, true);
    this.ku = (e: KeyboardEvent) => this.handleKey(e, false);
    window.addEventListener('keydown', this.kd);
    window.addEventListener('keyup', this.ku);
    this.bindTouch();
  }

  private handleKey(e: KeyboardEvent, down: boolean) {
    const k = e.key;
    let consumed = true;
    switch (k) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        this.state.gas = down;
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        this.state.brake = down;
        break;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        this.state.leanBack = down;
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        this.state.leanFwd = down;
        break;
      case 'r':
      case 'R':
        if (down) this.onRestart?.();
        break;
      case 'Escape':
        if (down) this.onMenu?.();
        break;
      default:
        consumed = false;
    }
    if (consumed) e.preventDefault();
  }

  private bindTouch() {
    const root = document.getElementById('touch');
    if (!root) return;
    const buttons = root.querySelectorAll<HTMLButtonElement>('.touch-btn');
    buttons.forEach((btn) => {
      const act = btn.dataset.act as Action | undefined;
      if (!act) return;
      const on = (e: Event) => {
        e.preventDefault();
        this.state[act] = true;
      };
      const off = (e: Event) => {
        e.preventDefault();
        this.state[act] = false;
      };
      btn.addEventListener('touchstart', on, { passive: false });
      btn.addEventListener('touchend', off, { passive: false });
      btn.addEventListener('touchcancel', off, { passive: false });
      btn.addEventListener('mousedown', on);
      btn.addEventListener('mouseup', off);
      btn.addEventListener('mouseleave', off);
      this.touchUnsub.push(() => {
        btn.removeEventListener('touchstart', on);
        btn.removeEventListener('touchend', off);
        btn.removeEventListener('touchcancel', off);
        btn.removeEventListener('mousedown', on);
        btn.removeEventListener('mouseup', off);
        btn.removeEventListener('mouseleave', off);
      });
    });
  }

  reset() {
    this.state.gas = false;
    this.state.brake = false;
    this.state.leanFwd = false;
    this.state.leanBack = false;
  }

  destroy() {
    window.removeEventListener('keydown', this.kd);
    window.removeEventListener('keyup', this.ku);
    this.touchUnsub.forEach((u) => u());
    this.touchUnsub = [];
  }
}
