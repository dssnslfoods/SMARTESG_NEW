import { ReactNode, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

interface PageTransitionProps {
  children: ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
  const location = useLocation();
  const [displayChildren, setDisplayChildren] = useState(children);
  const [transitionStage, setTransitionStage] = useState<'enter' | 'idle'>('idle');
  const prevPathRef = useRef(location.pathname);

  useEffect(() => {
    if (prevPathRef.current !== location.pathname) {
      prevPathRef.current = location.pathname;
      setTransitionStage('enter');
      setDisplayChildren(children);
    }
  }, [location.pathname, children]);

  const handleAnimationEnd = () => {
    setTransitionStage('idle');
  };

  return (
    <div
      key={location.pathname}
      onAnimationEnd={handleAnimationEnd}
      style={{
        animation: transitionStage === 'enter'
          ? 'iosPageEnter 0.38s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards'
          : undefined,
        willChange: 'transform, opacity',
      }}
    >
      {displayChildren}
    </div>
  );
}
