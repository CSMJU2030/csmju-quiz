import {
  hashRoomPass,
  newRoomPass,
  readRoomPass,
  ROOM_PASS_COOKIE,
  ROOM_PASS_TTL_MS,
  roomPassPath,
} from './room-pass';

describe('room pass', () => {
  it('ค่าสุ่ม 32 bytes · เก็บเฉพาะ sha256 · หมดอายุใน 4 ชั่วโมง', () => {
    const pass = newRoomPass(1_000);
    expect(Buffer.from(pass.value, 'base64url')).toHaveLength(32);
    expect(pass.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(pass.hash).toBe(hashRoomPass(pass.value));
    expect(pass.hash).not.toContain(pass.value);
    expect(pass.expiresAt.getTime()).toBe(1_000 + ROOM_PASS_TTL_MS);
    expect(ROOM_PASS_TTL_MS).toBe(4 * 60 * 60 * 1000);
    expect(newRoomPass().value).not.toBe(newRoomPass().value);
  });

  it('อ่านบัตรจาก header Cookie · รูปแบบผิดไม่รับ', () => {
    const { value } = newRoomPass();
    expect(readRoomPass(`a=1; ${ROOM_PASS_COOKIE}=${value}`)).toBe(value);
    expect(readRoomPass(`${ROOM_PASS_COOKIE}=short`)).toBeNull();
    expect(readRoomPass(undefined)).toBeNull();
  });

  it('คุกกี้ผูก path ของห้อง', () => {
    expect(roomPassPath('abc')).toBe('/api/v1/guest-games/abc');
  });
});
