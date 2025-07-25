import React from 'react';
import './CombinationGuide.css';
import sunImage from '../../sun.png';
import moonImage from '../../moon.png';
import starImage from '../../star.png';
import cloudImage from '../../cloud.png';

interface CombinationGuideProps {
  isOpen: boolean;
  onClose: () => void;
  onShowGameGuide: () => void;
}

const CombinationGuide: React.FC<CombinationGuideProps> = ({ isOpen, onClose, onShowGameGuide }) => {
  if (!isOpen) return null;

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

  const renderCard = (value: number, color: string) => (
    <div className="guide-card">
      <img src={getCardImage(color)!} alt={color} className="guide-card-image" />
      <span className="guide-card-value">{value}</span>
    </div>
  );

  return (
    <div className="combination-guide-overlay" onClick={onClose}>
      <div className="combination-guide-modal" onClick={(e) => e.stopPropagation()}>
        <div className="guide-header">
          <h2>LexiOnline</h2>
          <div className="header-buttons">
            <button className="game-guide-btn" onClick={onShowGameGuide} title="게임 가이드북">
              💡
            </button>
            <button className="close-btn" onClick={onClose}>×</button>
          </div>
        </div>
        
        <div className="guide-content">
          {/* 싱글 */}
          <div className="combination-section">
            <h3>싱글 (한 개의 타일)</h3>
            <div className="combination-example">
              {renderCard(13, 'cloud')}
              <span className="comparison-arrow">&#60;</span>
              {renderCard(13, 'star')}
              <span className="comparison-arrow">&#60;</span>
              {renderCard(13, 'moon')}
              <span className="comparison-arrow">&#60;</span>
              {renderCard(13, 'sun')}
            </div>
          </div>

          {/* 원페어 */}
          <div className="combination-section">
            <h3>원페어 (같은 수 2개)</h3>
            <div className="combination-example">
              <div className="pair-group">
                {renderCard(4, 'moon')}
                {renderCard(4, 'star')}
              </div>
              <span className="comparison-arrow">&#60;</span>
              <div className="pair-group">
                {renderCard(11, 'sun')}
                {renderCard(11, 'cloud')}
              </div>
            </div>
          </div>

          {/* 트리플 */}
          <div className="combination-section">
            <h3>트리플 (같은 수 3개)</h3>
            <div className="combination-example">
              <div className="triple-group">
                {renderCard(5, 'moon')}
                {renderCard(5, 'sun')}
                {renderCard(5, 'cloud')}
              </div>
              <span className="comparison-arrow">&#60;</span>
              <div className="triple-group">
                {renderCard(7, 'moon')}
                {renderCard(7, 'star')}
                {renderCard(7, 'cloud')}
              </div>
            </div>
          </div>

          {/* 스트레이트 */}
          <div className="combination-section">
            <h3>스트레이트 (연속된 수 5개)</h3>
            <div className="combination-example">
              <div className="straight-group">
                {renderCard(1, 'sun')}
                {renderCard(2, 'moon')}
                {renderCard(3, 'star')}
                {renderCard(4, 'cloud')}
                {renderCard(5, 'moon')}
              </div>
            </div>
          </div>

          {/* 플러쉬 */}
          <div className="combination-section">
            <h3>플러쉬 (같은 모양 5개)</h3>
            <div className="combination-example">
              <div className="flush-group">
                {renderCard(1, 'sun')}
                {renderCard(15, 'sun')}
                {renderCard(13, 'sun')}
                {renderCard(6, 'sun')}
                {renderCard(3, 'sun')}
              </div>
            </div>
          </div>

          {/* 풀 하우스 */}
          <div className="combination-section">
            <h3>풀 하우스 (같은 수 3개 + 같은 수 2개)</h3>
            <div className="combination-example">
              <div className="fullhouse-group">
                <div className="triple-part">
                  {renderCard(8, 'moon')}
                  {renderCard(8, 'star')}
                  {renderCard(8, 'cloud')}
                </div>
                <div className="pair-part">
                  {renderCard(3, 'sun')}
                  {renderCard(3, 'star')}
                </div>
              </div>
            </div>
          </div>

          {/* 포 카드 */}
          <div className="combination-section">
            <h3>포 카드 (같은 수 4개 + 원하는 타일 1개)</h3>
            <div className="combination-example">
              <div className="fourcard-group">
                <div className="four-part">
                  {renderCard(15, 'sun')}
                  {renderCard(15, 'star')}
                  {renderCard(15, 'moon')}
                  {renderCard(15, 'cloud')}
                </div>
                <div className="kicker-part">
                  {renderCard(10, 'cloud')}
                </div>
              </div>
            </div>
          </div>

          {/* 스트레이트 플러쉬 */}
          <div className="combination-section">
            <h3>스트레이트 플러쉬 (모양이 같은 연속된 수 5개)</h3>
            <div className="combination-example">
              <div className="straightflush-group">
                {renderCard(5, 'cloud')}
                {renderCard(6, 'cloud')}
                {renderCard(7, 'cloud')}
                {renderCard(8, 'cloud')}
                {renderCard(9, 'cloud')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CombinationGuide; 