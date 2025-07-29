import React, { useState, useEffect, useRef, useMemo } from 'react';
import './ResultScreen.css';
import ColyseusService from '../../services/ColyseusService';



interface ResultScreenProps {
  onScreenChange: (screen: 'lobby' | 'waiting' | 'game' | 'result') => void;
  playerCount: number;
  roundResult?: any;
}

interface RoundResult {
  scores: Array<{
    playerId: string;
    score: number;
    nickname: string;
    scoreDiff: number;
  }>;
  round: number;
  isGameEnd: boolean;
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

const ResultScreen: React.FC<ResultScreenProps> = ({ onScreenChange, playerCount, roundResult: initialRoundResult }) => {
  const [transferMessage, setTransferMessage] = useState('');
  const [currentTransferStep, setCurrentTransferStep] = useState(0);
  const [showArrow, setShowArrow] = useState(false);
  const [showButtons, setShowButtons] = useState(true);
  const [roundResult, setRoundResult] = useState<RoundResult | null>(initialRoundResult || null);
  const [actualPlayerCount, setActualPlayerCount] = useState(playerCount);
  const [isLayoutReady, setIsLayoutReady] = useState(false);

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
    
    for (let i = 0; i < actualPlayerCount; i++) {
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
    
    // 모든 요소가 렌더링되었는지 확인
    const allElementsReady = Object.values(newCenters).every(center => center !== null);
    if (allElementsReady && !isLayoutReady) {
      setIsLayoutReady(true);
    }
  }, [showArrow, currentTransferStep, actualPlayerCount, isLayoutReady]);

  useEffect(() => {
    // Colyseus 서비스에서 라운드 결과 정보 가져오기
    const room = ColyseusService.getRoom();
    if (room) {
      // 실제 플레이어 수 가져오기
      const playerCount = room.state.players.size;
      setActualPlayerCount(playerCount);
      console.log('실제 플레이어 수:', playerCount);

      // 라운드 결과 메시지 수신
      const handleRoundEnded = (message: RoundResult) => {
        console.log('라운드 결과 수신:', message);
        console.log('scores 배열:', message.scores);
        console.log('scores 길이:', message.scores?.length);
        setRoundResult(message);
      };

      room.onMessage('roundEnded', handleRoundEnded);
      room.onMessage('gameEnded', handleRoundEnded);

      // 기존에 이미 결과가 있는지 확인
      console.log('현재 room.state:', room.state);
      console.log('현재 플레이어들:', Array.from(room.state.players.entries()));
      
      // 이미 게임이 끝난 상태라면 현재 플레이어 정보로 결과 구성
      const currentPlayers = Array.from(room.state.players.entries()) as [string, any][];
      if (currentPlayers.length > 0) {
        const scores = currentPlayers.map(([id, p]) => ({
          playerId: id,
          score: p.hand ? p.hand.length : 0, // 남은 카드 수
          nickname: p.nickname || '익명',
          scoreDiff: 0
        }));
        
        // 점수 순으로 정렬 (낮은 점수가 높은 순위)
        scores.sort((a, b) => a.score - b.score);
        
        const currentResult: RoundResult = {
          scores,
          round: room.state.round || 1,
          isGameEnd: true
        };
        
        console.log('현재 상태로 결과 구성:', currentResult);
        setRoundResult(currentResult);
      }

      return () => {
        // cleanup 함수는 비워둠 (리스너가 자동으로 정리됨)
      };
    }
  }, []);

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
    
    const steps = generateSteps(actualPlayerCount);
    let currentStep = 0;
    setTransferMessage(steps[0]);
    setCurrentTransferStep(0);
    setShowButtons(false); // 애니메이션 시작 시 버튼 숨김
    
    // 요소들이 완전히 렌더링된 후 애니메이션 시작
    const startAnimation = () => {
      setShowArrow(true);
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
      return timer;
    };
    
    // 레이아웃이 준비된 후에만 애니메이션 시작
    if (isLayoutReady) {
      const timer = setTimeout(() => {
        startAnimation();
      }, 100);
      
      return () => {
        clearTimeout(timer);
      };
    }
  }, [actualPlayerCount, isLayoutReady]);

  // roundResult 변경 감지
  useEffect(() => {
    console.log('roundResult 변경됨:', roundResult);
    if (roundResult?.scores) {
      console.log('scores 상세:', roundResult.scores);
    }
  }, [roundResult]);

  const handlePlayAgain = () => {
    console.log('다시하기');
    const room = ColyseusService.getRoom();
    if (room) {
      room.send('playAgain', {});
    }
    onScreenChange('waiting');
  };

  const handleBackToLobby = () => {
    console.log('로비로 돌아가기');
    ColyseusService.disconnect();
    onScreenChange('lobby');
  };

  return (
    <div className="result-screen">
      <div className="result-container">
        {/* 상단 섹션 - 상대방 정보 */}
        <div className="opponent-section">
          <div className={`circular-layout players-${actualPlayerCount}`} ref={layoutRef}>
            {/* 플레이어 박스들을 동적으로 생성 */}
            {roundResult?.scores.map((player, index) => {
              const rank = index + 1;
              const tileCount = player.score; // score가 남은 카드 수
              const rankColors = ['gold', 'silver', 'bronze', 'black', 'gray'];
              const rankColor = rankColors[index] || 'gray';
              
              return (
                <div key={index} className="player-box">
                  <div className="player-placeholder">{player.nickname}</div>
                  <div className="tiles-info">
                    <span className="remaining-count">{tileCount}장</span>
                    <div className={`tile-count ${rankColor}`} ref={tileRefs[`player${index}` as keyof typeof tileRefs]}>
                      {tileCount}
                    </div>
                  </div>
                </div>
              );
            }) || Array.from({ length: actualPlayerCount }, (_, index) => {
              // roundResult가 없을 때는 기본 플레이어 박스 표시
              const rank = index + 1;
              const rankColors = ['gold', 'silver', 'bronze', 'black', 'gray'];
              const rankColor = rankColors[index] || 'gray';
              
              return (
                <div key={index} className="player-box">
                  <div className="player-placeholder">닉네임</div>
                  <div className="tiles-info">
                    <span className="remaining-count">0장</span>
                    <div className={`tile-count ${rankColor}`} ref={tileRefs[`player${index}` as keyof typeof tileRefs]}>
                      0
                    </div>
                  </div>
                </div>
              );
            })}
            {/* SVG 화살표 */}
            {showArrow && (
              <>
                {/* 플레이어 수에 따른 화살표 애니메이션 */}
                {currentTransferStep === 0 && actualPlayerCount >= 2 && (
                  <AnimatedArrow from={centers.player1} to={centers.player0} visible={true} />
                )}
                {currentTransferStep === 0 && actualPlayerCount >= 3 && (
                  <AnimatedArrow from={centers.player2} to={centers.player0} visible={true} />
                )}
                {currentTransferStep === 0 && actualPlayerCount >= 4 && (
                  <AnimatedArrow from={centers.player3} to={centers.player0} visible={true} />
                )}
                {currentTransferStep === 0 && actualPlayerCount >= 5 && (
                  <AnimatedArrow from={centers.player4} to={centers.player0} visible={true} />
                )}
                
                {currentTransferStep === 1 && actualPlayerCount >= 3 && (
                  <AnimatedArrow from={centers.player2} to={centers.player1} visible={true} />
                )}
                {currentTransferStep === 1 && actualPlayerCount >= 4 && (
                  <AnimatedArrow from={centers.player3} to={centers.player1} visible={true} />
                )}
                {currentTransferStep === 1 && actualPlayerCount >= 5 && (
                  <AnimatedArrow from={centers.player4} to={centers.player1} visible={true} />
                )}
                
                {currentTransferStep === 2 && actualPlayerCount >= 4 && (
                  <AnimatedArrow from={centers.player3} to={centers.player2} visible={true} />
                )}
                {currentTransferStep === 2 && actualPlayerCount >= 5 && (
                  <AnimatedArrow from={centers.player4} to={centers.player2} visible={true} />
                )}
                
                {currentTransferStep === 3 && actualPlayerCount >= 5 && (
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