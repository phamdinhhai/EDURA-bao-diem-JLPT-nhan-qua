const TARGET_ROTATION = Object.freeze({
  // Artwork có tâm ô Voucher 500K ở vị trí 12 giờ; mỗi tâm cách nhau 60°.
  // Các góc dưới đây xoay đúng tâm ô đến kim, không cộng lệch nửa sector (30°).
  VOUCHER_500K: 0,
  VOUCHER_800K: 60,
  VOUCHER_1000K: 120,
  SCHOLARSHIP_50: 180,
  SCHOLARSHIP_80: 240,
  SCHOLARSHIP_100: 300
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
