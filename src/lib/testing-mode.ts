export function isTestingModeEnabled() {
  const value = process.env.TESTING_MODE_ENABLED ?? '';
  return value.trim().length > 0 && ['1', 'true', 'yes'].includes(value.trim().toLowerCase());
}
