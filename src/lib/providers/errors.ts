export class FinancialProviderError extends Error {
  code: string;
  status: number;

  constructor(message: string, options?: { code?: string; status?: number }) {
    super(message);
    this.name = 'FinancialProviderError';
    this.code = options?.code ?? 'provider_error';
    this.status = options?.status ?? 500;
  }
}

export class ProviderConfigError extends FinancialProviderError {
  constructor(message: string) {
    super(message, {
      code: 'provider_config_error',
      status: 503,
    });
    this.name = 'ProviderConfigError';
  }
}

export class ProviderAuthError extends FinancialProviderError {
  constructor(message: string) {
    super(message, {
      code: 'provider_auth_error',
      status: 502,
    });
    this.name = 'ProviderAuthError';
  }
}

export class ProviderValidationError extends FinancialProviderError {
  constructor(message: string, status = 400) {
    super(message, {
      code: 'provider_validation_error',
      status,
    });
    this.name = 'ProviderValidationError';
  }
}

export class ProviderConflictError extends FinancialProviderError {
  constructor(message: string) {
    super(message, {
      code: 'provider_conflict_error',
      status: 409,
    });
    this.name = 'ProviderConflictError';
  }
}

export class ProviderTransientError extends FinancialProviderError {
  constructor(message: string) {
    super(message, {
      code: 'provider_transient_error',
      status: 503,
    });
    this.name = 'ProviderTransientError';
  }
}

export class ProviderUnsupportedError extends FinancialProviderError {
  constructor(message: string) {
    super(message, {
      code: 'provider_unsupported_error',
      status: 400,
    });
    this.name = 'ProviderUnsupportedError';
  }
}
