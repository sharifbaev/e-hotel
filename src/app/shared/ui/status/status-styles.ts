import { PaymentStatus, RoleCode, RoomStatus } from '../../../core/models';

/** Цвета статусов из дизайна (контраст текста ≥ 4.5:1 на своей подложке). */
export interface Tone {
  bg: string;
  border: string;
  fg: string;
  num: string;
  dot: string;
}

export const ROOM_TONE: Record<RoomStatus, Tone> = {
  free: { bg: '#EAF5EE', border: '#CDE7D6', num: '#1F6B45', fg: '#1F6B45', dot: '#2E8B57' },
  busy: { bg: '#FCEBEC', border: '#F5CCD0', num: '#B42318', fg: '#9B1C1C', dot: '#D92D20' },
  clean: { bg: '#FBF0E6', border: '#F1D7BD', num: '#A15C1F', fg: '#8A4A14', dot: '#E8A54B' },
  repair: { bg: '#F2F4F7', border: '#E4E7EC', num: '#475467', fg: '#344054', dot: '#98A2B3' },
};

export const ROOM_STATUSES: RoomStatus[] = ['free', 'busy', 'clean', 'repair'];

export const PAY_TONE: Record<PaymentStatus, { bg: string; fg: string }> = {
  paid: { bg: '#E7F6EC', fg: '#166534' },
  part: { bg: '#DCE7FD', fg: '#1E3A8A' },
  wait: { bg: '#FDEBD3', fg: '#7A3A0A' },
};

const ROLE_TONES: Record<string, { bg: string; fg: string }> = {
  owner: { bg: '#EDE9FE', fg: '#5B21B6' },
  admin: { bg: '#E6F4F2', fg: '#0B5A54' },
  accountant: { bg: '#F2F4F7', fg: '#344054' },
};

/** Созданные пользователем роли — цвет по коду из этой палитры. */
const CUSTOM_TONES = [
  { bg: '#DCE7FD', fg: '#1E3A8A' },
  { bg: '#FBF0E6', fg: '#8A4A14' },
  { bg: '#FEF0C7', fg: '#93370D' },
  { bg: '#E7F6EC', fg: '#067647' },
  { bg: '#FCE7F6', fg: '#9E165F' },
];

export function roleTone(code: RoleCode): { bg: string; fg: string } {
  const known = ROLE_TONES[code];
  if (known) {
    return known;
  }
  let h = 0;
  for (const ch of code ?? '') {
    h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  }
  return CUSTOM_TONES[h % CUSTOM_TONES.length];
}

/** Системные роли (подписи — перевод roles.<code>). */
export const SYSTEM_ROLES: RoleCode[] = ['owner', 'admin', 'accountant'];
