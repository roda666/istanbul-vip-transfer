'use client';

import { useEffect, useState } from 'react';

/**
 * True while the #rezervasyon booking form section is intersecting the
 * viewport. Shared by every floating widget (WhatsApp, chat launcher) that
 * must get out of the way while the visitor is filling in the booking form —
 * the form is already tight on mobile and a floating bubble on top of it
 * both wastes space and distracts from completing the request.
 */
export function useBookingFormVisible(): boolean {
  const [formVisible, setFormVisible] = useState(false);

  useEffect(() => {
    const section = document.getElementById('rezervasyon');
    if (!section || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => setFormVisible(entry.isIntersecting),
      { threshold: 0.03 },
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  return formVisible;
}
