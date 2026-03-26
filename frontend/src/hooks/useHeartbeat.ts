import { useEffect, useRef } from 'react';
import { sendHeartbeat } from '../services/api';

const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const IDLE_THRESHOLD = 60000; // 60 seconds

export function useHeartbeat() {
  const lastActivity = useRef(Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    const onActivity = () => {
      lastActivity.current = Date.now();
    };

    window.addEventListener('mousemove', onActivity);
    window.addEventListener('keydown', onActivity);
    window.addEventListener('click', onActivity);
    window.addEventListener('scroll', onActivity);

    intervalRef.current = setInterval(() => {
      const idle = Date.now() - lastActivity.current > IDLE_THRESHOLD;
      sendHeartbeat(!idle);
    }, HEARTBEAT_INTERVAL);

    return () => {
      window.removeEventListener('mousemove', onActivity);
      window.removeEventListener('keydown', onActivity);
      window.removeEventListener('click', onActivity);
      window.removeEventListener('scroll', onActivity);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);
}
