const TARGET_ROTATION = Object.freeze({
  // Góc quay đưa tâm từng ô quà đến kim cố định ở vị trí 12 giờ.
  SCHOLARSHIP_50: 330,
  VOUCHER_1000K: 270,
  VOUCHER_800K: 210,
  VOUCHER_500K: 150,
  SCHOLARSHIP_100: 90,
  SCHOLARSHIP_80: 30
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
