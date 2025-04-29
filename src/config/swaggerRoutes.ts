// src/config/swaggerRoutes.ts

export const swaggerRoutes = {
  getAllRecipes: {
    summary: "Preia toate rețetele",
    description: "Preia lista tuturor rețetelor din baza de date",
    responses: {
      200: {
        description: "Lista tuturor rețetelor",
        content: {
          "application/json": {
            schema: {
              type: "array",
              items: {
                type: "object",
              },
            },
          },
        },
      },
    },
  },
  getRecipesByType: {
    summary: "Preia rețetele după tip",
    description: "Filtrarea rețetelor după tipul lor (mic-dejun, prânz, etc.)",
    parameters: [
      {
        in: "path",
        name: "type",
        required: true,
        schema: {
          type: "string",
        },
        description: "Tipul rețetei (ex: mic-dejun, prânz, etc.)",
      },
    ],
    responses: {
      200: {
        description: "Lista rețetelor după tip",
        content: {
          "application/json": {
            schema: {
              type: "array",
              items: {
                type: "object",
              },
            },
          },
        },
      },
    },
  },
  getRecipesByCuisine: {
    summary: "Preia rețetele după bucătărie",
    description: "Filtrarea rețetelor în funcție de tipul de bucătărie",
    parameters: [
      {
        in: "path",
        name: "cuisine",
        required: true,
        schema: {
          type: "string",
        },
        description: "Tipul bucătăriei (ex: romanian, italian, american)",
      },
    ],
    responses: {
      200: {
        description: "Lista rețetelor după tipul de bucătărie",
        content: {
          "application/json": {
            schema: {
              type: "array",
              items: {
                type: "object",
              },
            },
          },
        },
      },
    },
  },
};
