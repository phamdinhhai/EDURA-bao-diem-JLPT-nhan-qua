const SECTOR_ANGLE = 360 / 7;
const TARGET_ROTATION = Object.freeze({
  // Kim thật hướng sang phải. Artwork mới có 7 sector bằng nhau.
  // Thứ tự clockwise từ ô bên phải: 50%, 1.000K, 800K, 500K, 100%, Tài liệu, 80%.
  SCHOLARSHIP_50: 0,
  VOUCHER_1000K: 6 * SECTOR_ANGLE,
  VOUCHER_800K: 5 * SECTOR_ANGLE,
  VOUCHER_500K: 4 * SECTOR_ANGLE,
  SCHOLARSHIP_100: 3 * SECTOR_ANGLE,
  JLPT_MATERIALS_N5_N1: 2 * SECTOR_ANGLE,
  SCHOLARSHIP_80: SECTOR_ANGLE
});

let rotation = 0;

export function spinTo(element, prizeCode) {
  const target = TARGET_ROTATION[prizeCode];
  if (target === undefined) throw new Error('INVALID_PRIZE');

  const current = ((rotation % 360) + 360) % 360;
  const forwardToTarget = (target - current + 360) % 360;
  rotation += (7 * 360) + forwardToTarget;

  element.classList.add('is-spinning');
  element.style.transform = `rotate(${rotation}deg)`;

  return new Promise(resolve => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      element.removeEventListener('transitionend', finish);
      resolve();
    };
    element.addEventListener('transitionend', finish, { once: true });
    window.setTimeout(finish, 6500);
  });
}
