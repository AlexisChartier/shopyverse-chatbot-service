import { IntentDetector } from '../../nlu/intentDetector.js';

describe('IntentDetector', () => {
  const detector = new IntentDetector();

  test('detects FAQ intent for delivery question', () => {
    expect(detector.detect('Quels sont vos délais de livraison ?')).toBe('FAQ');
  });

  test('detects PRODUCT_SEARCH intent for shopping query', () => {
    expect(detector.detect('Je cherche un t-shirt en coton')).toBe('PRODUCT_SEARCH');
  });

  test('falls back to OTHER for unrelated questions', () => {
    expect(detector.detect('Explique-moi la relativité générale')).toBe('OTHER');
  });
});
