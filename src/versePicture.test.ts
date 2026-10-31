import { describe, expect, it } from 'vitest';
import { pictureParts } from './versePicture';

describe('pictureParts', () => {
  it('takes references off verses and keeps plain words', () => {
    expect(pictureParts('John 3:16\nFor God so loved the world\n\n1 Corinthians 13:4-5\n4 Charity suffereth long\n5 Doth not behave')).toEqual({
      paragraphs: ['For God so loved the world', 'Charity suffereth long Doth not behave'],
      refs: ['John 3:16', '1 Corinthians 13:4-5'],
    });
    expect(pictureParts('The Favor of God is Priceless')).toEqual({ paragraphs: ['The Favor of God is Priceless'], refs: [] });
  });
});
