import React, { useState, useRef, useEffect } from 'react';

const CATEGORY_ICON = {
  shot: "🎾",
  position: "📍",
  warning: "⚠️",
  rally: "🔥",
  praise: "✅",
};

const SENTIMENT_STYLE = {
  good: "border-green-500/60 bg-green-950/60",
  bad: "border-red-500/60 bg-red-950/60",
  neutral: "border-gray-600/60 bg-black/80",
};

export default function VideoPlayer({ videoUrl, fileName, onOpenDetails, liveScript = [] }) {
  const videoRef = useRef(null);
  const [activeComment, setActiveComment] = useState(null);
  const [commentFeed, setCommentFeed] = useState([]);
  const hideTimer = useRef(null);
  const lastShownIdx = useRef(-1);

  const handleTimeUpdate = () => {
    if (!liveScript.length || !videoRef.current) return;
    const currentTime = videoRef.current.currentTime;

    const match = liveScript.find((item, idx) => {
      if (idx <= lastShownIdx.current) return false;
      return Math.abs(item.ts - currentTime) < 0.5;
    });

    if (match) {
      const idx = liveScript.indexOf(match);
      lastShownIdx.current = idx;
      setActiveComment(match);
      setCommentFeed(prev => [match, ...prev].slice(0, 4));
      clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setActiveComment(null), 4000);
    }
  };

  const handleSeeked = () => {
    if (!videoRef.current) return;
    const seekTime = videoRef.current.currentTime;
    let lastIdx = -1;
    liveScript.forEach((item, idx) => {
      if (item.ts < seekTime - 0.5) lastIdx = idx;
    });
    lastShownIdx.current = lastIdx;
    setActiveComment(null);
    clearTimeout(hideTimer.current);
  };

  useEffect(() => {
    setActiveComment(null);
    setCommentFeed([]);
    lastShownIdx.current = -1;
    return () => clearTimeout(hideTimer.current);
  }, [videoUrl, liveScript]);

  return (
    <div className="w-full h-full flex flex-col bg-black relative">

      <div className="flex-1 flex items-center justify-center overflow-hidden relative">
        <video
          ref={videoRef}
          src={videoUrl}
          controls
          onTimeUpdate={handleTimeUpdate}
          onSeeked={handleSeeked}
          className="max-w-full max-h-full object-contain"
        />

        {/* OVERLAY COMENTARIU ACTIV */}
        <div
          className={`absolute top-6 left-6 right-6 pointer-events-none transition-all duration-500
            ${activeComment ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}`}
        >
          {activeComment && (
            <div className={`border backdrop-blur-md p-4 rounded-2xl shadow-2xl max-w-sm
              ${SENTIMENT_STYLE[activeComment.sentiment] || SENTIMENT_STYLE.neutral}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base leading-none">
                  {CATEGORY_ICON[activeComment.category] || "🤖"}
                </span>
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">
                  {activeComment.category} · {activeComment.ts.toFixed(1)}s
                </p>
              </div>
              <p className="text-white text-sm font-bold leading-snug">
                {activeComment.text}
              </p>
            </div>
          )}
        </div>

        {/* FEED LATERAL */}
        {commentFeed.length > 0 && (
          <div className="absolute bottom-16 right-4 flex flex-col gap-2 pointer-events-none max-w-[240px]">
            {commentFeed.map((c, i) => (
              <div
                key={`${c.ts}-${i}`}
                className={`border rounded-xl px-3 py-2 transition-all duration-300
                  ${i === 0 ? 'opacity-100 scale-100' : 'opacity-40 scale-95'}
                  ${SENTIMENT_STYLE[c.sentiment] || SENTIMENT_STYLE.neutral}`}
              >
                <span className="text-[10px] text-gray-300 font-bold">
                  {CATEGORY_ICON[c.category]} {c.text.slice(0, 60)}{c.text.length > 60 ? '…' : ''}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* PLACEHOLDER */}
        {liveScript.length === 0 && (
          <div className="absolute top-6 left-6 pointer-events-none">
            <div className="bg-black/80 backdrop-blur-md border border-gray-700/40 p-4 rounded-2xl">
              <p className="text-gray-500 text-[10px] font-black uppercase mb-1">AI Coach</p>
              <p className="text-gray-400 text-sm font-bold">Încarcă un video pentru analiză live...</p>
            </div>
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div className="h-12 bg-gray-900/50 flex items-center justify-between px-6 border-t border-gray-800">
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-gray-500 font-bold truncate max-w-[200px]">{fileName}</span>
          {liveScript.length > 0 && (
            <span className="text-[8px] text-green-500/60 font-mono uppercase">
              {liveScript.length} comentarii AI
            </span>
          )}
        </div>
        <button
          onClick={onOpenDetails}
          className="text-green-500 text-[10px] font-black uppercase hover:text-green-400 transition-colors"
        >
          Report 📊
        </button>
      </div>
    </div>
  );
}