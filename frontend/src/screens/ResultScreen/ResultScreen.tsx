import React, { useState, useEffect, useRef } from 'react';
import './ResultScreen.css';



interface ResultScreenProps {
  onScreenChange: (screen: 'lobby' | 'waiting' | 'game' | 'result') => void;
}

// AnimatedArrow 컴포넌트: SVG 화살표 + 애니메이션
const AnimatedArrow: React.FC<{
  from: { x: number; y: number } | null;
  to: { x: number; y: number } | null;
  visible: boolean;
}> = ({ from, to, visible }) => {
  const ARROW_RADIUS = 35; // 원의 반지름(px)
  const ARROW_HEAD_SIZE = 25; // 화살촉 크기를 18에서 25로 증가
  const [progress, setProgress] = React.useState(0);

  React.useEffect(() => {
    if (visible) {
      setProgress(0);
      // 애니메이션 시작
      const startTime = Date.now();
      const duration = 1500; // 1.5초로 단축
      
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const newProgress = Math.min(elapsed / duration, 1);
        setProgress(newProgress);
        
        if (newProgress < 1) {
          requestAnimationFrame(animate);
        }
      };
      
      requestAnimationFrame(animate);
    } else {
      setProgress(0);
    }
  }, [from, to, visible]);

  if (!from || !to || !visible) return null;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const angle = Math.atan2(dy, dx);
  // 시작점: from 중심에서 to 방향으로 ARROW_RADIUS만큼 이동
  const startX = from.x + Math.cos(angle) * ARROW_RADIUS;
  const startY = from.y + Math.sin(angle) * ARROW_RADIUS;
  // 끝점: to 중심에서 from 방향으로 ARROW_RADIUS만큼 이동
  const endX = to.x - Math.cos(angle) * ARROW_RADIUS;
  const endY = to.y - Math.sin(angle) * ARROW_RADIUS;
  const totalLength = Math.sqrt((endX - startX) ** 2 + (endY - startY) ** 2);
  const currentLength = progress * totalLength;
  // 현재 길이에 따른 끝점 계산
  const currentEndX = startX + (endX - startX) * progress;
  const currentEndY = startY + (endY - startY) * progress;
  // 화살촉 좌표 (현재 끝점에서 더 나아간 위치)
  const arrowHeadX = currentEndX + (ARROW_HEAD_SIZE * 0.4) * Math.cos(angle);
  const arrowHeadY = currentEndY + (ARROW_HEAD_SIZE * 0.4) * Math.sin(angle);

  return (
    <svg className="arrow-svg" width="600" height="600" style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 20 }}>
      <line
        x1={startX}
        y1={startY}
        x2={currentEndX}
        y2={currentEndY}
        stroke="#ffd700"
        strokeWidth={7}
        strokeLinecap="round"
        style={{}}
      />
      {/* 화살촉 - 선과 함께 움직임 */}
      <polygon
        points={`
          ${arrowHeadX},${arrowHeadY}
          ${arrowHeadX - ARROW_HEAD_SIZE * Math.cos(angle - 0.35)},${arrowHeadY - ARROW_HEAD_SIZE * Math.sin(angle - 0.35)}
          ${arrowHeadX - ARROW_HEAD_SIZE * Math.cos(angle + 0.35)},${arrowHeadY - ARROW_HEAD_SIZE * Math.sin(angle + 0.35)}
        `}
        fill="#ffd700"
        style={{}}
      />
    </svg>
  );
};

const ResultScreen: React.FC<ResultScreenProps> = ({ onScreenChange }) => {
  const [transferMessage, setTransferMessage] = useState('');
  const [currentTransferStep, setCurrentTransferStep] = useState(0);
  const [showArrow, setShowArrow] = useState(false);
  const [showButtons, setShowButtons] = useState(true);

  // 각 타일카운트 원의 ref
  const tileRefs = {
    top: useRef<HTMLDivElement>(null),
    right: useRef<HTMLDivElement>(null),
    bottom: useRef<HTMLDivElement>(null),
    left: useRef<HTMLDivElement>(null),
  };
  const layoutRef = useRef<HTMLDivElement>(null);
  const [centers, setCenters] = useState<{ [key: string]: { x: number; y: number } | null }>({
    top: null, right: null, bottom: null, left: null,
  });

  // 위치 계산
  useEffect(() => {
    const calc = (key: keyof typeof tileRefs) => {
      const tile = tileRefs[key].current;
      const layout = layoutRef.current;
      if (tile && layout) {
        const tileRect = tile.getBoundingClientRect();
        const layoutRect = layout.getBoundingClientRect();
        return {
          x: tileRect.left + tileRect.width / 2 - layoutRect.left,
          y: tileRect.top + tileRect.height / 2 - layoutRect.top,
        };
      }
      return null;
    };
    setCenters({
      top: calc('top'),
      right: calc('right'),
      bottom: calc('bottom'),
      left: calc('left'),
    });
  }, [showArrow, currentTransferStep]);

  useEffect(() => {
    const steps = [
      '1등과의 남은 타일 개수 차이만큼 코인을 전달',
      '2등과의 남은 타일 개수 차이만큼 코인을 전달',
      '3등과의 남은 타일 개수 차이만큼 코인을 전달',
      '결과 집계 완료!'
    ];
    let currentStep = 0;
    setTransferMessage(steps[0]);
    setCurrentTransferStep(0);
    setShowArrow(true);
    setShowButtons(false); // 애니메이션 시작 시 버튼 숨김
    const timer = setInterval(() => {
      if (currentStep < steps.length - 1) {
        currentStep++;
        setTransferMessage(steps[currentStep]);
        setCurrentTransferStep(currentStep);
        setShowArrow(true);
      } else {
        setShowArrow(false);
        clearInterval(timer);
        
        // "결과 집계 완료!" 메시지가 표시된 후 2초 뒤에 버튼 표시
        setTimeout(() => {
          setTransferMessage('');
          setShowButtons(true);
        }, 2000);
      }
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const handlePlayAgain = () => {
    console.log('다시하기');
    onScreenChange('waiting');
  };

  const handleBackToLobby = () => {
    console.log('로비로 돌아가기');
    onScreenChange('lobby');
  };

  return (
    <div className="result-screen">
      <div className="result-container">
        {/* 상단 섹션 - 상대방 정보 */}
        <div className="opponent-section">
          <div className="circular-layout players-4" ref={layoutRef}>
            {/* 1등 플레이어 (top) */}
            <div className="player-box">
              <div className="player-placeholder">닉네임</div>
              <div className="tiles-info tiles-info-bottom">
                <span>0장</span>
                <div className="tile-count gold" ref={tileRefs.top}>0</div>
              </div>
            </div>
            {/* 2등 플레이어 (right) */}
            <div className="player-box">
              <div className="player-placeholder">닉네임</div>
              <div className="tiles-info tiles-info-left">
                <span>2장</span>
                <div className="tile-count silver" ref={tileRefs.right}>2</div>
              </div>
            </div>
            {/* 3등 플레이어 (bottom) */}
            <div className="player-box">
              <div className="player-placeholder">닉네임</div>
              <div className="tiles-info tiles-info-top">
                <div className="tile-count bronze" ref={tileRefs.bottom}>10</div>
                <span>5장</span>
              </div>
            </div>
            {/* 4등 플레이어 (left) */}
            <div className="player-box">
              <div className="player-placeholder">닉네임</div>
              <div className="tiles-info tiles-info-right">
                <span>10장</span>
                <div className="tile-count black" ref={tileRefs.left}>5</div>
              </div>
            </div>
            {/* SVG 화살표 */}
            {showArrow && (
              <>
                {/* 1등 전달: 왼쪽, 아래쪽, 오른쪽 -> 위쪽 */}
                {currentTransferStep === 0 && (
                  <>
                    <AnimatedArrow from={centers.left} to={centers.top} visible={true} />
                    <AnimatedArrow from={centers.bottom} to={centers.top} visible={true} />
                    <AnimatedArrow from={centers.right} to={centers.top} visible={true} />
                  </>
                )}
                {/* 2등 전달: 왼쪽, 아래쪽 -> 오른쪽 */}
                {currentTransferStep === 1 && (
                  <>
                    <AnimatedArrow from={centers.left} to={centers.right} visible={true} />
                    <AnimatedArrow from={centers.bottom} to={centers.right} visible={true} />
                  </>
                )}
                {/* 3등 전달: 아래쪽 -> 왼쪽 */}
                {currentTransferStep === 2 && (
                  <AnimatedArrow from={centers.bottom} to={centers.left} visible={true} />
                )}
              </>
            )}
          </div>
        </div>

        {/* 하단 정보 바 */}
        {!showButtons && (
          <div className="transfer-info">
            <span>{transferMessage}</span>
          </div>
        )}

        {/* 컨트롤 버튼들 */}
        {showButtons && (
          <div className="controls">
            <button className="btn btn-primary" onClick={handlePlayAgain}>
              다시하기
            </button>
            <button className="btn btn-secondary" onClick={handleBackToLobby}>
              로비로 돌아가기
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResultScreen;