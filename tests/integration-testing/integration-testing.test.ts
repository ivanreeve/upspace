import { describe, expect, it } from 'vitest';

import { integrationTestingFixture, type IntegrationEpic, type IntegrationTestType } from '../fixtures/integration-testing';

const requiredEpics: IntegrationEpic[] = ['authentication', 'discovery', 'search', 'booking', 'payment'];
const requiredTypes: IntegrationTestType[] = ['positive', 'negative'];

describe('Integration Testing fixture', () => {
  it('covers all required epics', () => {
    const epics = new Set<IntegrationEpic>();
    integrationTestingFixture.forEach((testCase) => testCase.epics.forEach((epic) => epics.add(epic)));
    requiredEpics.forEach((epic) => expect(epics.has(epic)).toBe(true));
  });

  it('includes positive and negative scenarios for every epic', () => {
    requiredEpics.forEach((epic) => {
      const casesForEpic = integrationTestingFixture.filter((testCase) => testCase.epics.includes(epic));
      const types = new Set(casesForEpic.map((testCase) => testCase.type));
      requiredTypes.forEach((type) => expect(types.has(type)).toBe(true));
    });
  });

  it('defines well-formed integration cases', () => {
    const ids = new Set<string>();
    integrationTestingFixture.forEach((testCase) => {
      expect(testCase.id).toMatch(/^flow\/[a-z0-9-]+$/);
      expect(ids.has(testCase.id)).toBe(false);
      ids.add(testCase.id);

      expect(testCase.title.trim().length).toBeGreaterThan(0);
      expect(testCase.description.trim().length).toBeGreaterThan(0);

      expect(testCase.epics.length).toBeGreaterThan(0);
      expect(testCase.preconditions.length).toBeGreaterThan(0);
      expect(testCase.steps.length).toBeGreaterThan(0);
      expect(testCase.expectedSystem.length).toBeGreaterThan(0);
      expect(testCase.expectedUI.length).toBeGreaterThan(0);
      expect(testCase.touchpoints.length).toBeGreaterThan(0);
    });
  });
});
