import { useLayoutEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { GoArrowUpRight } from 'react-icons/go';

const CardNav = ({
  items,
  className = '',
  ease = 'power3.out',
  baseColor = 'bg-[#1a1d24]',
  menuColor = 'text-green-500'
}) => {
  const [isHamburgerOpen, setIsHamburgerOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const navRef = useRef(null);
  const cardsRef = useRef([]);
  const tlRef = useRef(null);

  const calculateHeight = () => {
    const navEl = navRef.current;
    if (!navEl) return 64;
    const contentEl = navEl.querySelector('.card-nav-content');
    return contentEl ? 64 + contentEl.scrollHeight + 32 : 400;
  };

  const createTimeline = () => {
    const navEl = navRef.current;
    if (!navEl) return null;
    gsap.set(navEl, { height: 64, overflow: 'hidden' });
    gsap.set(cardsRef.current, { y: 20, opacity: 0 });

    const tl = gsap.timeline({ paused: true });
    tl.to(navEl, { height: calculateHeight, duration: 0.5, ease });
    tl.to(cardsRef.current, { y: 0, opacity: 1, duration: 0.4, ease, stagger: 0.1 }, '-=0.2');
    return tl;
  };

  useLayoutEffect(() => {
    const tl = createTimeline();
    tlRef.current = tl;
    return () => tl?.kill();
  }, [items]);

  const toggleMenu = () => {
    const tl = tlRef.current;
    if (!tl) return;
    if (!isExpanded) {
      setIsHamburgerOpen(true);
      setIsExpanded(true);
      tl.play(0);
    } else {
      setIsHamburgerOpen(false);
      tl.reverse().eventCallback('onReverseComplete', () => setIsExpanded(false));
    }
  };

  const setCardRef = (i) => (el) => { if (el) cardsRef.current[i] = el; };

  return (
    <div className={`w-full relative ${className}`}>
      <nav 
        ref={navRef} 
        className={`w-full h-[64px] ${baseColor} border border-white/5 rounded-3xl relative overflow-hidden transition-all duration-300 ${isExpanded ? 'border-green-500/30' : ''}`}
      >
        {/* TOP BAR */}
        <div className="h-[64px] flex items-center justify-between px-6 z-10 relative">
          {/* Hamburger */}
          <div
            className={`flex flex-col gap-1.5 cursor-pointer z-20 ${menuColor}`}
            onClick={toggleMenu}
            role="button"
          >
            <div className={`w-7 h-0.5 bg-current transition-all duration-300 ${isHamburgerOpen ? 'rotate-45 translate-y-2' : ''}`} />
            <div className={`w-7 h-0.5 bg-current transition-all duration-300 ${isHamburgerOpen ? 'opacity-0' : ''}`} />
            <div className={`w-7 h-0.5 bg-current transition-all duration-300 ${isHamburgerOpen ? '-rotate-45 -translate-y-2' : ''}`} />
          </div>

          {/* Centered Text: MENU. */}
          <div className="absolute left-1/2 -translate-x-1/2">
            <span className="text-xl font-black tracking-[0.3em] text-white uppercase italic">
              MENU<span className="text-green-500">.</span>
            </span>
          </div>

          {/* Spacer to keep MENU centered */}
          <div className="w-7"></div>
        </div>

        {/* CONTENT - Vertical Stack */}
        <div className="card-nav-content absolute top-[64px] left-0 right-0 p-4 flex flex-col gap-4 z-0" aria-hidden={!isExpanded}>
          {(items || []).map((item, idx) => (
            <div
              key={idx}
              className="w-full rounded-2xl p-6 flex flex-col gap-4 border border-white/5 min-h-[110px]"
              ref={setCardRef(idx)}
              style={{ backgroundColor: item.bgColor, color: item.textColor }}
            >
              <div className="text-2xl font-black uppercase italic tracking-tighter">{item.label}</div>
              <div className="flex flex-col gap-2 mt-auto">
                {item.links?.map((lnk, i) => (
                  <button 
                    key={i} 
                    className="flex items-center gap-2 text-inherit opacity-70 hover:opacity-100 transition-all text-left w-full group"
                    onClick={() => {
                      if (lnk.onClick) lnk.onClick();
                      toggleMenu();
                    }}
                  >
                    <GoArrowUpRight className="text-sm group-hover:text-green-400" />
                    <span className="font-bold text-xs tracking-tight">{lnk.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default CardNav;