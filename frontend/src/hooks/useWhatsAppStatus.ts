import { useState, useEffect } from 'react';

export function useWhatsAppStatus() {
  const [status, setStatus] = useState<'Connected' | 'Connecting' | 'Error' | 'Disconnected'>('Connected');

  // In a real app, this would poll your backend or use WebSockets to check the Meta API status
  useEffect(() => {
    // Mocking a stable connection
    setStatus('Connected');
  }, []);

  return status;
}
