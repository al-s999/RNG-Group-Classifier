export function cryptoRandomInt(maxExclusive: number): number {
  if (maxExclusive <= 0) return 0;
  const range = 0xffffffff;
  const bucketSize = Math.floor((range + 1) / maxExclusive);
  const limit = bucketSize * maxExclusive;

  const buf = new Uint32Array(1);
  while (true) {
    crypto.getRandomValues(buf);
    const x = buf[0];
    if (x < limit) return Math.floor(x / bucketSize);
  }
}

export function shuffleCrypto<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = cryptoRandomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
