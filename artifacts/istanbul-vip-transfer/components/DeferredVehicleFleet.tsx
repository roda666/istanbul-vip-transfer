'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';

// VehicleFleet downloads vehicle data and Framer Motion. It appears well below
// the hero, so defer both until a visitor is about to reach the section.
const VehicleFleet = dynamic(() => import('./VehicleFleet'), { ssr: false });

export default function DeferredVehicleFleet({ homepageMode = false, grouped }: { homepageMode?: boolean; grouped?: boolean }) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const target = sectionRef.current;
    if (!target || !('IntersectionObserver' in window)) {
      setShouldLoad(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setShouldLoad(true);
        observer.disconnect();
      },
      { rootMargin: '0px 0px -10%' },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={sectionRef} className="ivt-deferred-section" aria-busy={!shouldLoad}>
      {shouldLoad && <VehicleFleet homepageMode={homepageMode} grouped={grouped} />}
    </div>
  );
}