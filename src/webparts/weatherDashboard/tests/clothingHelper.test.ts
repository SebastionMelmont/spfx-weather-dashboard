import { getClothingRecommendation } from '../helpers/clothingHelper';

describe('getClothingRecommendation', () => {
  // Hot weather
  it('returns single light layer for temps above 25°C', () => {
    expect(getClothingRecommendation(30)).toBe('Single light layer');
    expect(getClothingRecommendation(26)).toBe('Single light layer');
    expect(getClothingRecommendation(40)).toBe('Single light layer');
  });

  // Warm weather
  it('returns light layer + jacket for 18-25°C', () => {
    expect(getClothingRecommendation(25)).toBe('Light layer + jacket');
    expect(getClothingRecommendation(20)).toBe('Light layer + jacket');
    expect(getClothingRecommendation(19)).toBe('Light layer + jacket');
  });

  // Cool weather
  it('returns two layers for 10-18°C', () => {
    expect(getClothingRecommendation(18)).toBe('Two layers');
    expect(getClothingRecommendation(15)).toBe('Two layers');
    expect(getClothingRecommendation(11)).toBe('Two layers');
  });

  // Cold weather
  it('returns three layers for 0-10°C', () => {
    expect(getClothingRecommendation(10)).toBe('Three layers');
    expect(getClothingRecommendation(5)).toBe('Three layers');
    expect(getClothingRecommendation(1)).toBe('Three layers');
  });

  // Freezing weather
  it('returns four+ layers for below 0°C', () => {
    expect(getClothingRecommendation(0)).toBe('Four+ layers, heavy coat');
    expect(getClothingRecommendation(-5)).toBe('Four+ layers, heavy coat');
    expect(getClothingRecommendation(-20)).toBe('Four+ layers, heavy coat');
  });

  // Boundary values
  it('handles exact boundary temperatures correctly', () => {
    expect(getClothingRecommendation(25.1)).toBe('Single light layer');
    expect(getClothingRecommendation(25)).toBe('Light layer + jacket');
    expect(getClothingRecommendation(18.1)).toBe('Light layer + jacket');
    expect(getClothingRecommendation(18)).toBe('Two layers');
    expect(getClothingRecommendation(10.1)).toBe('Two layers');
    expect(getClothingRecommendation(10)).toBe('Three layers');
    expect(getClothingRecommendation(0.1)).toBe('Three layers');
    expect(getClothingRecommendation(0)).toBe('Four+ layers, heavy coat');
  });
});
