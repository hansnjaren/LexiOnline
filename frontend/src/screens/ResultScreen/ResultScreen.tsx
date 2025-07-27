import React, { useState, useEffect, useRef, useMemo } from 'react';
import './ResultScreen.css';



interface ResultScreenProps {
  onScreenChange: (screen: 'lobby' | 'waiting' | 'game' | 'result') => void;
  playerCount: number;
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

const ResultScreen: React.FC<ResultScreenProps> = ({ onScreenChange, playerCount }) => {
  const [transferMessage, setTransferMessage] = useState('');
  const [currentTransferStep, setCurrentTransferStep] = useState(0);
  const [showArrow, setShowArrow] = useState(false);
  const [showButtons, setShowButtons] = useState(true);

  // 각 타일카운트 원의 ref를 개별적으로 생성
  const player0Ref = useRef<HTMLDivElement>(null);
  const player1Ref = useRef<HTMLDivElement>(null);
  const player2Ref = useRef<HTMLDivElement>(null);
  const player3Ref = useRef<HTMLDivElement>(null);
  const player4Ref = useRef<HTMLDivElement>(null);
  
  const tileRefs: { [key: string]: React.RefObject<HTMLDivElement | null> } = {
    player0: player0Ref,
    player1: player1Ref,
    player2: player2Ref,
    player3: player3Ref,
    player4: player4Ref,
  };
  
  const layoutRef = useRef<HTMLDivElement>(null);
  const [centers, setCenters] = useState<{ [key: string]: { x: number; y: number } | null }>({});

  // 위치 계산
  useEffect(() => {
    const newCenters: { [key: string]: { x: number; y: number } | null } = {};
    
    for (let i = 0; i < playerCount; i++) {
      const key = `player${i}`;
      const tile = tileRefs[key]?.current;
      const layout = layoutRef.current;
      if (tile && layout) {
        const tileRect = tile.getBoundingClientRect();
        const layoutRect = layout.getBoundingClientRect();
        newCenters[key] = {
          x: tileRect.left + tileRect.width / 2 - layoutRect.left,
          y: tileRect.top + tileRect.height / 2 - layoutRect.top,
        };
      } else {
        newCenters[key] = null;
      }
    }
    
    setCenters(newCenters);
  }, [showArrow, currentTransferStep, playerCount]);

  useEffect(() => {
    // 참가자 인원수에 따라 메시지 배열 동적 생성
    const generateSteps = (count: number) => {
      const steps = [];
      
              // 1등부터 (count-1)등까지의 메시지 추가
        for (let i = 1; i < count; i++) {
          steps.push(`<span class="guide-tag">🔎 GUIDE</span> ${i}등과의 남은 타일 개수 차이만큼 코인을 전달`);
        }
      
      // 마지막에 결과 집계 완료 메시지 추가
      steps.push('결과 집계 완료!');
      
      return steps;
    };
    
    const steps = generateSteps(playerCount);
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
  }, [playerCount]);

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
          <div className={`circular-layout players-${playerCount}`} ref={layoutRef}>
            {/* 플레이어 박스들을 동적으로 생성 */}
            {Array.from({ length: playerCount }, (_, index) => {
              const rank = index + 1;
              const tileCounts = [0, 2, 10, 5, 8]; // 예시 데이터
              const tileCount = tileCounts[index] || 0;
              const rankColors = ['gold', 'silver', 'bronze', 'black', 'black'];
              const rankColor = rankColors[index] || 'gray';
              
              return (
                <div key={index} className="player-box">
                  <div className="player-placeholder">닉네임</div>
                  <div className="tiles-info">
                    <span className="remaining-count">{tileCount}장</span>
                    <div className={`tile-count ${rankColor}`} ref={tileRefs[`player${index}` as keyof typeof tileRefs]}>
                      {tileCount}
                    </div>
                  </div>
                </div>
              );
            })}
            {/* SVG 화살표 */}
            {showArrow && (
              <>
                {/* 플레이어 수에 따른 화살표 애니메이션 */}
                {currentTransferStep === 0 && playerCount >= 2 && (
                  <AnimatedArrow from={centers.player1} to={centers.player0} visible={true} />
                )}
                {currentTransferStep === 0 && playerCount >= 3 && (
                  <AnimatedArrow from={centers.player2} to={centers.player0} visible={true} />
                )}
                {currentTransferStep === 0 && playerCount >= 4 && (
                  <AnimatedArrow from={centers.player3} to={centers.player0} visible={true} />
                )}
                {currentTransferStep === 0 && playerCount >= 5 && (
                  <AnimatedArrow from={centers.player4} to={centers.player0} visible={true} />
                )}
                
                {currentTransferStep === 1 && playerCount >= 3 && (
                  <AnimatedArrow from={centers.player2} to={centers.player1} visible={true} />
                )}
                {currentTransferStep === 1 && playerCount >= 4 && (
                  <AnimatedArrow from={centers.player3} to={centers.player1} visible={true} />
                )}
                {currentTransferStep === 1 && playerCount >= 5 && (
                  <AnimatedArrow from={centers.player4} to={centers.player1} visible={true} />
                )}
                
                {currentTransferStep === 2 && playerCount >= 4 && (
                  <AnimatedArrow from={centers.player3} to={centers.player2} visible={true} />
                )}
                {currentTransferStep === 2 && playerCount >= 5 && (
                  <AnimatedArrow from={centers.player4} to={centers.player2} visible={true} />
                )}
                
                {currentTransferStep === 3 && playerCount >= 5 && (
                  <AnimatedArrow from={centers.player4} to={centers.player3} visible={true} />
                )}
              </>
            )}
          </div>
        </div>

        {/* 하단 정보 바 */}
        {!showButtons && (
          <div className={`transfer-info ${transferMessage === '결과 집계 완료!' ? 'complete-message' : ''}`}>
            <span dangerouslySetInnerHTML={{ __html: transferMessage }}></span>
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