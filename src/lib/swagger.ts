import { createSwaggerSpec } from 'next-swagger-doc';

export const getApiDocs = async () => {
  const spec = createSwaggerSpec({
    apiFolder: 'src/app/api/v1', // point to folder with annotated route handlers
    definition: {
      openapi: '3.0.0',
      info: {
        title: 'UpSpace API',
        version: '1.0.0',
        description: 'API documentation for UpSpace',
      },
    },
  });
  return spec;
};
