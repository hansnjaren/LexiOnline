// backend/src/gameLogic/calculateRanks.ts

export interface RankData {
  playerId: string;
  userId: number | null;
  score: number;
  rating_mu_before: number;
  rating_sigma_before: number;
}

export function calculateRanks(finalScores: Array<RankData>) {
  const sorted = [...finalScores].sort((a, b) => b.score - a.score);
  return finalScores.map(player => {
    const rank = sorted.findIndex(p => p.playerId === player.playerId) + 1;
    return {
      ...player,
      rank,
    };
  });
}
