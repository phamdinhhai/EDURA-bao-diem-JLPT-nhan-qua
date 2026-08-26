const TARGET_ROTATION = Object.freeze({
  // Tâm gốc theo chiều kim đồng hồ: 50%, 1000K, 800K, 500K, 100%, 80%.
  // Kim thật hướng sang phải (3 giờ); rotation = góc kim - góc tâm gốc.
  SCHOLARSHIP_50: 120,
  VOUCHER_1000K: 60,
  VOUCHER_800K: 0,
  VOUCHER_500K: 300,
  SCHOLARSHIP_100: 240,
  SCHOLARSHIP_80: 180
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
