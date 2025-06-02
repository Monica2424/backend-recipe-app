import { PrismaClient, Prisma } from '@prisma/client';
import { FetchRecipes, categories } from './FetchRecipes';
import { generateCuisineDescription } from './seedHelpers';

const prisma = new PrismaClient();

async function main() {
  // Șterge toate rețetele și bucătăriile existente
  await prisma.recipe.deleteMany({});
  await prisma.cuisine.deleteMany({});

  // Opțional, resetare secvențe (dacă folosești Postgres)
  await prisma.$executeRawUnsafe(`ALTER SEQUENCE "Recipe_id_seq" RESTART WITH 1`);
  await prisma.$executeRawUnsafe(`ALTER SEQUENCE "Cuisine_id_seq" RESTART WITH 1`);

  let allRecipes: (Omit<Prisma.RecipeCreateManyInput, 'cuisineId'> & { cuisineName: string })[] = [];
  const cuisineImageMap = new Map<string, string>();

  // Fetch pe categorii și acumulăm datele
  for (const category of categories) {
    const { finalRecipes, cuisineImageMap: catCuisineImageMap } = await FetchRecipes(category.tag, category.recipeType);

    allRecipes = allRecipes.concat(finalRecipes);

    // Combinăm imaginile (primul din fiecare categorie)
    for (const [key, value] of catCuisineImageMap.entries()) {
      if (!cuisineImageMap.has(key)) {
        cuisineImageMap.set(key, value);
      }
    }

    console.log(`Fetched and filtered ${finalRecipes.length} recipes for ${category.recipeType}`);
  }

  // Extragem bucătăriile unice, filtrăm numele valide
  const cuisineNames = Array.from(
    new Set(allRecipes.map(r => r.cuisineName).filter(name => typeof name === 'string' && name.trim() !== ''))
  );

  // Creăm bucătăriile în baza de date, cu descriere + imagine
  for (const name of cuisineNames) {
    const image = cuisineImageMap.get(name) || "";
    const description = await generateCuisineDescription(name);

    await prisma.cuisine.create({
      data: {
        name,
        description,
        image,
      }
    });
  }

  // Luăm toate bucătăriile create și facem mapă name => id
  const cuisines = await prisma.cuisine.findMany();
  const cuisineMap = new Map(cuisines.map(c => [c.name, c.id]));

  // Construim rețetele cu cuisineId corespunzător
  const allRecipesWithCuisineId: Prisma.RecipeCreateManyInput[] = allRecipes.map(r => ({
    title: r.title,
    description: r.description,
    image: r.image,
    ingredients: r.ingredients,
    instructions: r.instructions,
    prepTime: r.prepTime,
    cookTime: r.cookTime,
    servings: r.servings,
    recipeType: r.recipeType,
    cuisineId: cuisineMap.get(r.cuisineName)!,
    source: r.source,
  }));

  // Inserăm rețetele (skip duplicates ca să evităm erorile)
  await prisma.recipe.createMany({
    data: allRecipesWithCuisineId,
    skipDuplicates: true,
  });

  console.log(`Seeded ${allRecipesWithCuisineId.length} recipes and ${cuisines.length} cuisines.`);
}

main()
  .then(() => {
    console.log('Seed finished!');
    return prisma.$disconnect();
  })
  .catch(e => {
    console.error('Seed failed:', e);
    prisma.$disconnect();
    process.exit(1);
  });
