export interface Vec2 {
  x: number;
  y: number;
}

export interface LevelDef {
  id: string;
  name: string;
  /** Polyline points for the track surface, left → right. */
  points: Vec2[];
  /** Spawn position for the bike. */
  start: Vec2;
  /** Finish line x-coordinate. Reaching it triggers FINISH. */
  finishX: number;
  /** Optional difficulty hint, just a label. */
  difficulty: 'easy' | 'medium' | 'hard';
}

export type GameState = 'menu' | 'playing' | 'finished' | 'crashed';

export interface InputState {
  gas: boolean;
  brake: boolean;
  leanFwd: boolean;
  leanBack: boolean;
}
