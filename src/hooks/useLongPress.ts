import { useRef, useState } from 'react';

export function useLongPress(delay = 480) {
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firedRef    = useRef(false);
  const [pressingId, setPressingId] = useState<string | null>(null);

  const start = (id: string, onFire: () => void) => {
    firedRef.current = false;
    setPressingId(id);
    timerRef.current = setTimeout(() => {
      firedRef.current = true;
      setPressingId(null);
      onFire();
    }, delay);
  };

  const cancel = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    setPressingId(null);
  };

  /** Returns true if the most recent pointer interaction ended as a long press */
  const wasFired = () => firedRef.current;

  return { pressingId, start, cancel, wasFired };
}
