const TARGET_ROTATION = Object.freeze({
  // Kim thật hướng sang phải. Artwork production xác nhận mapping cũ lệch một ô (60°).
  // Các góc này đã dịch ngược một sector để prize_code trùng ô nằm dưới kim.
  SCHOLARSHIP_50: 60,
  VOUCHER_1000K: 0,
  VOUCHER_800K: 300,
  VOUCHER_500K: 240,
  SCHOLARSHIP_100: 180,
  SCHOLARSHIP_80: 120
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
