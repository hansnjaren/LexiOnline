import { useMemo } from 'react';
import ColyseusService from '../../../services/ColyseusService';
import { GameState } from '../types';
import sunImage from '../../../sun.png';
import moonImage from '../../../moon.png';
import starImage from '../../../star.png';
import cloudImage from '../../../cloud.png';

// Constants
const MADE_NONE = 0;
const MADE_STRAIGHT = 1;
const MADE_FLUSH = 2;
const MADE_FULLHOUSE = 3;
const MADE_FOURCARDS = 4;
const MADE_STRAIGHTFLUSH = 5;

const colorMapping = {
  'gold': 'sun',
  'silver': 'moon',
  'bronze': 'star',
  'black': 'cloud'
};

interface MadeEvalResult {
  type: number;
  value: number;
  valid: boolean;
  madeType?: number;
}

// Helper functions (not exported from hook)
const parseCard = (card: number, maxNumber: number) => {
  const type = Math.floor(card / maxNumber);
  const number = (card + maxNumber - 2) % maxNumber;
  return { type, number };
};

const getValue = (number: number, type: number, maxNumber: number): number => {
  return number * maxNumber + type;
};

const isStraightWithException = (numbers: number[], maxNumber: number): boolean => {
  const remappedNumbers = numbers.map(n => (n + 2) % maxNumber).sort((a, b) => a - b);

  let isConsecutive = true;
  for (let i = 0; i < remappedNumbers.length - 1; i++) {
    if (remappedNumbers[i+1] - remappedNumbers[i] !== 1) {
      isConsecutive = false;
      break;
    }
  }
  if (isConsecutive) return true;

  const mountainStraight = [0, maxNumber - 4, maxNumber - 3, maxNumber - 2, maxNumber - 1].sort((a,b) => a-b);
  const isMountain = remappedNumbers.length === mountainStraight.length && remappedNumbers.every((val, index) => val === mountainStraight[index]);
  if (isMountain) return true;

  return false;
}

const evaluateSimpleCombo = (cards: number[], maxNumber: number): MadeEvalResult => {
  const len = cards.length;
  if (![1, 2, 3].includes(len)) return { type: MADE_NONE, value: 0, valid: false };

  const parsed = cards.map(card => {
    const { type, number } = parseCard(card, maxNumber);
    return { type, number, value: number * maxNumber + type };
  });

  const firstNumber = parsed[0].number;
  if (!parsed.every(c => c.number === firstNumber)) return { type: MADE_NONE, value: 0, valid: false };

  const maxType = Math.max(...parsed.map(c => c.type));
  return { type: len, value: firstNumber * maxNumber + maxType, valid: true };
}

const evaluateMade = (cards: number[], maxNumber: number): MadeEvalResult => {
  if (cards.length !== 5) return { type: MADE_NONE, value: 0, valid: false };

  const parsed = cards.map(card => parseCard(card, maxNumber));
  const numbers = parsed.map(c => c.number);
  const types = parsed.map(c => c.type);

  const numCount = new Map<number, number>();
  const typeCount = new Map<number, number>();
  numbers.forEach(n => numCount.set(n, (numCount.get(n) || 0) + 1));
  types.forEach(t => typeCount.set(t, (typeCount.get(t) || 0) + 1));

  const isFlush = typeCount.size === 1;
  const isStraight = isStraightWithException(numbers.slice().sort((a, b) => a - b), maxNumber);

  let four = false, three = false, two = false;
  for (const count of Array.from(numCount.values())) {
    if (count === 4) four = true;
    else if (count === 3) three = true;
    else if (count === 2) two = true;
  }

  if (isFlush && isStraight) {
    const bestValue = Math.max(...parsed.map(p => getValue(p.number, p.type, maxNumber)));
    return { type: MADE_STRAIGHTFLUSH, value: bestValue, valid: true };
  }
  if (four) {
    const fourNumber = Array.from(numCount.entries()).find(([, count]) => count === 4)![0];
    const fourCards = parsed.filter(p => p.number === fourNumber);
    const bestType = Math.max(...fourCards.map(c => c.type));
    return { type: MADE_FOURCARDS, value: getValue(fourNumber, bestType, maxNumber), valid: true };
  }
  if (three && two) {
    const threeNumber = Array.from(numCount.entries()).find(([, count]) => count === 3)![0];
    const threeCards = parsed.filter(p => p.number === threeNumber);
    const bestType = Math.max(...threeCards.map(c => c.type));
    return { type: MADE_FULLHOUSE, value: getValue(threeNumber, bestType, maxNumber), valid: true };
  }
  if (isFlush) {
    const bestValue = Math.max(...parsed.map(p => getValue(p.number, p.type, maxNumber)));
    return { type: MADE_FLUSH, value: bestValue, valid: true };
  }
  if (isStraight) {
    const bestValue = Math.max(...parsed.map(p => getValue(p.number, p.type, maxNumber)));
    return { type: MADE_STRAIGHT, value: bestValue, valid: true };
  }
  return { type: MADE_NONE, value: 0, valid: false };
}

export const useCardUtils = (gameState: GameState, gameMode: 'easyMode' | 'normal') => {
  const getDisplayColor = useMemo(() => {
    return (originalColor: string) => {
      if (gameMode === 'easyMode') {
        return originalColor;
      } else {
        return colorMapping[originalColor as keyof typeof colorMapping] || originalColor;
      }
    };
  }, [gameMode]);

  const getCardImage = (color: string) => {
    switch (color) {
      case 'sun': return sunImage;
      case 'moon': return moonImage;
      case 'star': return starImage;
      case 'cloud': return cloudImage;
      default: return null;
    }
  };

  const getCardColorFromNumber = (cardNumber: number, maxNumber: number): string => {
    const safeMaxNumber = maxNumber > 0 ? maxNumber : 13;
    const colorIndex = Math.floor(cardNumber / safeMaxNumber);
    const colors = ['black', 'bronze', 'silver', 'gold'];
    return colors[colorIndex] || 'black';
  };

  const getCardValueFromNumber = (cardNumber: number, maxNumber: number): number => {
    const safeMaxNumber = maxNumber > 0 ? maxNumber : 13;
    return (cardNumber % safeMaxNumber) + 1;
  };

  const getLastTypeText = (lastType: number): string => {
    switch (lastType) {
      case 0: return '없음';
      case 1: return '싱글';
      case 2: return '원페어';
      case 3: return '트리플';
      case 4: return '포카드';
      case 5: return '메이드';
      default: return '알 수 없음';
    }
  };

  const getLastMadeTypeText = (lastMadeType: number): string => {
    switch (lastMadeType) {
      case 0: return '없음';
      case 1: return '스트레이트';
      case 2: return '플러시';
      case 3: return '풀하우스';
      case 4: return '포카드';
      case 5: return '스트레이트플러시';
      default: return '알 수 없음';
    }
  };

  const getCurrentCombinationText = (): string => {
    if (gameState.lastType === 0) {
      return '미등록';
    }
    if (gameState.lastType === 5) {
      return getLastMadeTypeText(gameState.lastMadeType);
    } else {
      return getLastTypeText(gameState.lastType);
    }
  };

  const canSubmitCards = (cardNumbers: number[]): { canSubmit: boolean; reason: string } => {
    if (cardNumbers.length === 0) {
      return { canSubmit: false, reason: "카드를 선택해주세요" };
    }

    const room = ColyseusService.getRoom();
    if (!room || !room.state) {
        return { canSubmit: false, reason: "게임 서버에 연결되지 않았습니다." };
    }
    const { maxNumber, lastType, lastMadeType, lastHighestValue } = room.state;

    let evaluationResult: MadeEvalResult;

    if (cardNumbers.length >= 1 && cardNumbers.length <= 3) {
        evaluationResult = evaluateSimpleCombo(cardNumbers, maxNumber);
    } else if (cardNumbers.length === 5) {
        const madeResult = evaluateMade(cardNumbers, maxNumber);
        evaluationResult = { ...madeResult, type: 5, madeType: madeResult.type };
    } else {
        return { canSubmit: false, reason: `잘못된 카드 개수입니다: ${cardNumbers.length}장` };
    }

    if (!evaluationResult.valid) {
        return { canSubmit: false, reason: "유효한 조합이 아닙니다." };
    }

    if (lastType === 0) {
        return { canSubmit: true, reason: "첫 턴 제출 가능" };
    }

    const currentType = evaluationResult.type;
    const currentValue = evaluationResult.value;
    const currentMadeType = evaluationResult.madeType || MADE_NONE;

    if (currentType === 5) {
        if (lastType === 5) {
            if (currentMadeType > lastMadeType) return { canSubmit: true, reason: "더 높은 족보" };
            if (currentMadeType === lastMadeType && currentValue > lastHighestValue) return { canSubmit: true, reason: "같은 족보, 더 높은 값" };
            return { canSubmit: false, reason: `더 낮은 족보 또는 값. 현재: ${getLastMadeTypeText(currentMadeType)}(${currentValue}), 이전: ${getLastMadeTypeText(lastMadeType)}(${lastHighestValue})` };
        }
        return { canSubmit: true, reason: "메이드가 이전 조합보다 높음" };
    }

    if (currentType >= 1 && currentType <= 3) {
        if (lastType === 5) return { canSubmit: false, reason: "메이드 다음에는 더 높은 메이드만 낼 수 있습니다." };
        if (currentType !== lastType) return { canSubmit: false, reason: `이전과 같은 개수의 카드를 내야 합니다. (이전: ${lastType}장, 현재: ${currentType}장)` };
        if (currentValue > lastHighestValue) return { canSubmit: true, reason: "더 높은 값" };
        return { canSubmit: false, reason: `더 낮은 값. 현재: ${currentValue}, 이전: ${lastHighestValue}` };
    }

    return { canSubmit: false, reason: "알 수 없는 오류" };
  };

  return {
    getDisplayColor,
    getCardImage,
    getCardColorFromNumber,
    getCardValueFromNumber,
    getCurrentCombinationText,
    canSubmitCards,
  };
};
