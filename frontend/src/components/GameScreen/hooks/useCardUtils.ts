import { useMemo } from 'react';
import ColyseusService from '../../../services/ColyseusService';
import { GameState } from '../types';
import sunImage from '../../../sun.png';
import moonImage from '../../../moon.png';
import starImage from '../../../star.png';
import cloudImage from '../../../cloud.png';
import {
  colorMapping,
  MadeEvalResult,
  evaluateSimpleCombo,
  evaluateMade,
  getLastMadeTypeText,
  getLastTypeText,
  getCardColorFromNumber as getCardColorFromNumberUtil,
  getCardValueFromNumber as getCardValueFromNumberUtil,
} from '../cardUtils';

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
    const currentMadeType = evaluationResult.madeType || 0;

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
    getCardColorFromNumber: getCardColorFromNumberUtil,
    getCardValueFromNumber: getCardValueFromNumberUtil,
    getCurrentCombinationText,
    canSubmitCards,
  };
};
