import axios from 'axios';
import generateDescription from './generateDescription';

const SPOONACULAR_API_KEY = process.env.SPOONACULAR_API_KEY!;

export const categories = [
  { tag: "dessert", recipeType: "dessert" },
  { tag: "breakfast", recipeType: "breakfast" },
  { tag: "main course", recipeType: "main" },
  { tag: "dinner", recipeType: "dinner" },
  { tag: "beverage", recipeType: "beverage" },
];

export async function FetchRecipes(tag: string, recipeType: string) {
  const response = await axios.get(`https://api.spoonacular.com/recipes/random`, {
    params: {
      number: 30,
      tags: tag,
      apiKey: SPOONACULAR_API_KEY,
    },
  });

  const recipes = response.data.recipes;

  const validRecipes = recipes
    .filter((recipe: any) => 
      recipe.image &&
      recipe.title &&
      recipe.summary &&
      recipe.extendedIngredients?.length &&
      recipe.instructions
    )
    .slice(0, 50);

  // Mapă pentru imagine pentru fiecare bucătărie (primul întâlnit)
  const cuisineImageMap = new Map<string, string>();

  validRecipes.forEach((recipe: { cuisines: string | any[]; image: string; }) => {
    const cuisineName = recipe.cuisines.length > 0 ? recipe.cuisines[0] : "Unknown";
    if (!cuisineImageMap.has(cuisineName)) {
      cuisineImageMap.set(cuisineName, recipe.image);
    }
  });

  const finalRecipes = await Promise.all(
    validRecipes.map(async (recipe: any) => {
      const ingredients = recipe.extendedIngredients.map((ing: any) => ing.original);
      const generatedDescription = await generateDescription(ingredients);

      const cuisineName = recipe.cuisines.length > 0 ? recipe.cuisines[0] : "Unknown";

      return {
        title: recipe.title,
        description: generatedDescription,
        image: recipe.image,
        ingredients: JSON.stringify(ingredients),
        instructions: recipe.instructions?.replace(/<[^>]*>?/gm, '') || "No instructions provided",
        prepTime: recipe.preparationMinutes || 10,
        cookTime: recipe.cookingMinutes || 15,
        servings: recipe.servings || 2,
        recipeType: recipeType,
        cuisineName,    // lăsăm numele bucătăriei, vom folosi în seed
        source: "api",
      };
    })
  );

  return { finalRecipes, cuisineImageMap };
}
