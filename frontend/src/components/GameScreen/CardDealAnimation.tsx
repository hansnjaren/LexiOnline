import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './CardDealAnimation.css';
import sunImage from '../../sun.png';
import moonImage from '../../moon.png';
import starImage from '../../star.png';
import cloudImage from '../../cloud.png';

interface CardDealAnimationProps {
  isVisible: boolean;
  onComplete: () => void;
  playerCount: number;
  cardsPerPlayer: number;
  myPlayerIndex: number;
  myHand: Array<{
    id: number;
    value: number;
    color: string;
  }>;
  onPlayerCardReceived?: (playerIndex: number) => void;
  onMyCardDealt?: (cardIndex: number) => void;
  gameMode: 'beginner' | 'normal';
}

interface Card {
  id: string;
  playerIndex: number;
  cardIndex: number;
  isDealt: boolean;
  isFlipped: boolean;
}

const CardDealAnimation: React.FC<CardDealAnimationProps> = ({
  isVisible,
  onComplete,
  playerCount,
  cardsPerPlayer,
  myPlayerIndex,
  myHand,
  onPlayerCardReceived,
  onMyCardDealt,
  gameMode
}) => {
  const [cards, setCards] = useState<Card[]>([]);
  const [dealtCount, setDealtCount] = useState(0);
  const [isDealing, setIsDealing] = useState(false);

  // 카드 색상 매핑 (초보모드 ↔ 일반모드)
  const colorMapping = {
    'gold': 'sun',    // 금색 ↔ 태양 (빨강)
    'silver': 'moon', // 은색 ↔ 달 (초록)
    'bronze': 'star', // 동색 ↔ 별 (노랑)
    'black': 'cloud'  // 검정색 ↔ 구름 (파랑)
  };

  // 현재 모드에 맞는 카드 색상 반환
  const getDisplayColor = (originalColor: string, mode: 'beginner' | 'normal') => {
    if (mode === 'beginner') {
      return originalColor;
    } else {
      return colorMapping[originalColor as keyof typeof colorMapping] || originalColor;
    }
  };

  // 카드 색상에 따른 이미지 반환
  const getCardImage = (color: string) => {
    switch (color) {
      case 'sun':
        return sunImage;
      case 'moon':
        return moonImage;
      case 'star':
        return starImage;
      case 'cloud':
        return cloudImage;
      default:
        return null;
    }
  };

  // 카드 초기화 (라운드 로빈 분배용)
  useEffect(() => {
    if (isVisible) {
      const initialCards: Card[] = [];
      for (let i = 0; i < cardsPerPlayer; i++) {
        for (let playerIndex = 0; playerIndex < playerCount; playerIndex++) {
          initialCards.push({
            id: `${playerIndex}-${i}`,
            playerIndex,
            cardIndex: i,
            isDealt: false,
            isFlipped: false
          });
        }
      }
      setCards(initialCards);
      setDealtCount(0);
      setIsDealing(false);
    }
  }, [isVisible, playerCount, cardsPerPlayer]);

  // 카드 분배 시작 (라운드 로빈)
  useEffect(() => {
    if (isVisible && cards.length > 0 && !isDealing) {
      setIsDealing(true);
      startDealing();
    }
    // eslint-disable-next-line
  }, [isVisible, cards.length, isDealing]);

  const startDealing = () => {
    let currentIndex = 0;
    const total = cards.length;

    const dealNextCard = () => {
      if (currentIndex >= total) {
        setTimeout(() => {
          onComplete();
        }, 500);
        return;
      }
      
      const card = cards[currentIndex];
      
      // 카드 분배 시작
      setCards(prev => prev.map((c, idx) =>
        idx === currentIndex ? { ...c, isDealt: true } : c
      ));

      if (card.playerIndex === myPlayerIndex) {
        // 내 카드: 분배 완료 콜백
        if (onMyCardDealt) {
          onMyCardDealt(card.cardIndex);
        }
      } else {
        // 다른 유저 카드: 남은 패 개수 증가 콜백
        if (onPlayerCardReceived) {
          onPlayerCardReceived(card.playerIndex);
        }
      }
      
      setDealtCount(prev => prev + 1);
      currentIndex++;
      setTimeout(dealNextCard, 120);
    };
    dealNextCard();
  };

  // 중앙 카드더미 위치 계산
  const centerPosition = {
    x: window.innerWidth / 2 - 21, // 42px/2
    y: window.innerHeight / 2 - 30 // 60px/2
  };

  // 각 플레이어 위치 계산 (직선 이동)
  const getPlayerPosition = (playerIndex: number) => {
    if (playerIndex === myPlayerIndex) {
      // 내 위치는 getMyCardPosition에서 처리
      return getMyCardPosition(cards.filter(c => c.playerIndex === myPlayerIndex && c.isDealt).length);
    } else {
      // 다른 플레이어 위치 (실제 UI 요소 기반)
      const playerElements = document.querySelectorAll('.player-info-container');
      if (playerElements[playerIndex]) {
        const playerRect = playerElements[playerIndex].getBoundingClientRect();
        return {
          x: playerRect.left + (playerRect.width / 2) - 21, // 카드 중앙 정렬
          y: playerRect.top + (playerRect.height / 2) - 30
        };
      }
      
      // 폴백: 기존 위치
      const positions = [
        { x: 180, y: 120 },
        { x: 180, y: 220 },
        { x: 180, y: 320 },
      ];
      return positions[playerIndex] || { x: 180, y: 200 };
    }
  };

  // 내 카드 위치 계산 (손패 영역)
  const getMyCardPosition = (cardIndex: number) => {
    // 실제 게임 화면의 .my-hand 영역 위치 계산
    const myHandElement = document.querySelector('.my-hand');
    
    if (myHandElement) {
      const handRect = myHandElement.getBoundingClientRect();
      
      // .my-hand 내부에서의 카드 위치 계산
      const cardWidth = 42; // hand-tile width
      const cardGap = 6; // gap between cards
      const cardSpacing = cardWidth + cardGap;
      
      // .my-hand의 시작 위치에서 카드 인덱스에 따른 위치 계산
      const cardX = handRect.left + (cardIndex * cardSpacing);
      const cardY = handRect.top;
      
      return {
        x: cardX,
        y: cardY
      };
    }
    
    // 폴백: 기존 계산 방식 (더 정확한 위치)
    const baseX = window.innerWidth / 2 - (myHand.length * 48) / 2;
    return {
      x: baseX + cardIndex * 48,
      y: window.innerHeight - 120
    };
  };

    if (!isVisible) return null;

  return (
    <div className="card-deal-animation">
      <AnimatePresence>
        {cards.map((card, idx) => {
          const isMyCard = card.playerIndex === myPlayerIndex;
          const targetPosition = isMyCard
            ? getMyCardPosition(card.cardIndex)
            : getPlayerPosition(card.playerIndex);
          return (
            <motion.div
              key={card.id}
              className={`dealing-card ${isMyCard ? 'my-card' : 'other-card'}`}
              initial={{
                x: centerPosition.x,
                y: centerPosition.y,
                rotateY: 0,
                scale: 1
              }}
              animate={{
                x: card.isDealt ? targetPosition.x : centerPosition.x,
                y: card.isDealt ? targetPosition.y : centerPosition.y,
                rotateY: isMyCard ? (card.isFlipped ? 0 : 180) : 180,
                scale: 1,
                opacity: card.isDealt ? (isMyCard ? 1 : 0) : 1
              }}
              transition={{
                duration: 0.4,
                ease: 'easeOut'
              }}
              onAnimationComplete={() => {
                if (isMyCard && card.isDealt && !card.isFlipped) {
                  setCards(prev => prev.map((c) =>
                    c.id === card.id ? { ...c, isFlipped: true } : c
                  ));
                  // hand-tile 활성화 콜백
                  if (onMyCardDealt) {
                    onMyCardDealt(card.cardIndex);
                  }
                }
              }}
              style={{
                position: 'absolute',
                zIndex: 1000
              }}
            >
              {/* 카드 뒷면 */}
              <div className="card-back" />
              {/* 내 카드만 앞면 */}
              {isMyCard && card.isFlipped && (
                <div 
                  className={`card-front ${(() => {
                    const cardData = myHand[card.cardIndex];
                    if (!cardData) return '';
                    const displayColor = getDisplayColor(cardData.color, gameMode);
                    return displayColor;
                  })()}`}
                >
                  <div className="card-content">
                    {(() => {
                      const cardData = myHand[card.cardIndex];
                      if (!cardData) return null;
                      const displayColor = getDisplayColor(cardData.color, gameMode);
                      const cardImage = getCardImage(displayColor);
                      return (
                        <>
                          {cardImage && (
                            <img src={cardImage} alt={displayColor} className="card-image" />
                          )}
                          <span className="card-value">{cardData.value}</span>
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

export default CardDealAnimation; 