import swaggerUi from 'swagger-ui-express';
import swaggerJSDoc from 'swagger-jsdoc';

export const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Recipe API',
      version: '1.0.0',
      description: 'API pentru gestionarea rețetelor culinare',
    },
    servers: [
      {
        url: `http://localhost:5000`,
      },
    ],
  },
  apis: ['./src/routes/*.ts', './src/config/swaggerRoutes.ts'], // Include și fișierul cu rutele Swagger
};

const swaggerSpec = swaggerJSDoc(swaggerOptions);

export { swaggerUi, swaggerSpec };
