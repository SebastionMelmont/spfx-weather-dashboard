/**
 * Returns a clothing layer recommendation based on temperature.
 * @param temperature - Current temperature in Celsius
 * @returns A string describing recommended layers
 */
export function getClothingRecommendation(temperature: number): string {
  if (temperature > 25) {
    return 'Single light layer';
  } else if (temperature > 18) {
    return 'Light layer + jacket';
  } else if (temperature > 10) {
    return 'Two layers';
  } else if (temperature > 0) {
    return 'Three layers';
  } else {
    return 'Four+ layers, heavy coat';
  }
}
