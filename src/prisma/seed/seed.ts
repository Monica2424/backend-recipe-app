import { PrismaClient, Prisma } from '@prisma/client';
import { FetchRecipes, categories } from './FetchRecipes';

const prisma = new PrismaClient();

async function main() {
  await prisma.recipe.deleteMany({});

  await prisma.$executeRawUnsafe(
    `ALTER SEQUENCE "Recipe_id_seq" RESTART WITH 1`
  );


  let allRecipes: Prisma.RecipeCreateManyInput[] = [];

  for (const category of categories) {
    const recipes = await FetchRecipes(category.tag, category.recipeType);
    allRecipes = allRecipes.concat(recipes);
    console.log(`Fetched and filtered ${recipes.length} recipes for ${category.recipeType}`);
  }

  await prisma.recipe.createMany({
    data: allRecipes,
    skipDuplicates: true,
  });

  console.log(`Seeded a total of ${allRecipes.length} recipes.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(e => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
