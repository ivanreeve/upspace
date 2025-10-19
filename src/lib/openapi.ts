'use server';

import openApiDocument from '../../public/openapi.json';

export type OpenApiDocument = typeof openApiDocument;

export const getApiDocs = async (): Promise<OpenApiDocument> => openApiDocument;
