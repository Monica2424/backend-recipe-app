import axios from 'axios';
import generateDescription from './generateDescription';


const SPOONACULAR_API_KEY = process.env.SPOONACULAR_API_KEY!;

export const categories = [
  { tag: "dessert", recipeType: "desert" },
  { tag: "breakfast", recipeType: "mic-dejun" },
  { tag: "main course", recipeType: "pranz" },
  { tag: "dinner", recipeType: "cina" },
  { tag: "beverage", recipeType: "bauturi" },
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
    .slice(0, 20);

  const finalRecipes = await Promise.all(
    validRecipes.map(async (recipe: any) => {
      const ingredients = recipe.extendedIngredients.map((ing: any) => ing.original);
      const generatedDescription = await generateDescription(ingredients);

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
        cuisineType: recipe.cuisines.length > 0 ? recipe.cuisines[0] : "Unknown",
        source: "api",
      };
    })
  );

  return finalRecipes;
}
