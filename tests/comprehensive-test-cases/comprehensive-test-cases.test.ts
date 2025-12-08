import { describe, expect, it } from 'vitest';

import {
  comprehensiveTestCasesFixture,
  type TestCase,
  type TestCaseArea,
  type TestCaseType
} from '../fixtures/comprehensive-test-cases';

const requiredAreas: TestCaseArea[] = ['authentication', 'discovery', 'search', 'booking', 'payment'];
const requiredTypes: TestCaseType[] = ['positive', 'negative'];

describe('Comprehensive Test Cases fixture', () => {
  it('includes entries for each required area', () => {
    const areas = new Set(comprehensiveTestCasesFixture.map((testCase) => testCase.area));
    requiredAreas.forEach((area) => expect(areas.has(area)).toBe(true));
  });

  it('provides both positive and negative cases per area', () => {
    requiredAreas.forEach((area) => {
      const casesForArea = comprehensiveTestCasesFixture.filter((testCase) => testCase.area === area);
      const types = new Set(casesForArea.map((testCase) => testCase.type));
      requiredTypes.forEach((type) => expect(types.has(type)).toBe(true));
    });
  });

  it('contains unique, well-formed test cases', () => {
    const ids = new Set<string>();
    comprehensiveTestCasesFixture.forEach((testCase) => {
      expect(testCase.id).toMatch(/^[a-z-]+\/[a-z-]+$/);
      expect(testCase.title.trim().length).toBeGreaterThan(0);
      expect(testCase.description.trim().length).toBeGreaterThan(0);
      expect(testCase.preconditions.length).toBeGreaterThan(0);
      expect(testCase.steps.length).toBeGreaterThan(0);
      expect(testCase.expected.length).toBeGreaterThan(0);
      expect(ids.has(testCase.id)).toBe(false);
      ids.add(testCase.id);
    });
  });
});
