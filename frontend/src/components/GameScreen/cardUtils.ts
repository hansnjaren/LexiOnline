import { GameState } from './types';

// Constants
export const MADE_NONE = 0;
export const MADE_STRAIGHT = 1;
export const MADE_FLUSH = 2;
export const MADE_FULLHOUSE = 3;
export const MADE_FOURCARDS = 4;
export const MADE_STRAIGHTFLUSH = 5;

export const colorMapping = {
  'gold': 'sun',
  'silver': 'moon',
  'bronze': 'star',
  'black': 'cloud'
};

export interface MadeEvalResult {
  type: number;
  value: number;
  valid: boolean;
  madeType?: number;
}

// Helper functions
export const parseCard = (card: number, maxNumber: number) => {
  const type = Math.floor(card / maxNumber);
  const number = (card + maxNumber - 2) % maxNumber;
  return { type, number };
};

export const getValue = (number: number, type: number, maxNumber: number): number => {
  return number * maxNumber + type;
};

export const isStraightWithException = (numbers: number[], maxNumber: number): boolean => {
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

export const evaluateSimpleCombo = (cards: number[], maxNumber: number): MadeEvalResult => {
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

export const evaluateMade = (cards: number[], maxNumber: number): MadeEvalResult => {
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

export const getCardColorFromNumber = (cardNumber: number, maxNumber: number): string => {
  const safeMaxNumber = maxNumber > 0 ? maxNumber : 13;
  const colorIndex = Math.floor(cardNumber / safeMaxNumber);
  const colors = ['black', 'bronze', 'silver', 'gold'];
  return colors[colorIndex] || 'black';
};

export const getCardValueFromNumber = (cardNumber: number, maxNumber: number): number => {
  const safeMaxNumber = maxNumber > 0 ? maxNumber : 13;
  return (cardNumber % safeMaxNumber) + 1;
};

export const getLastMadeTypeText = (lastMadeType: number): string => {
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

export const getLastTypeText = (lastType: number): string => {
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
