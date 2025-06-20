// backend/src/routes/aiRoutes.ts
import express from 'express';
import generateDescription from '../prisma/seed/generateDescription';
import { generateCuisineDescription } from '../prisma/seed/seedHelpers';
import { Cuisine } from '@prisma/client';

import axios from 'axios';

const router = express.Router();



// Endpoint pentru generare descriere rețetă
router.post('/generate-recipe-description', async (req, res) => {
    const { ingredients } = req.body;

    if (!ingredients) {
        return res.status(400).json({ error: 'Ingredients are required' });
    }

    try {
        // Dacă ingredients este string, convertește-l în array
        let ingredientsArray;
        if (typeof ingredients === 'string') {
            ingredientsArray = ingredients
                .split('\n')
                .map(ingredient => ingredient.trim())
                .filter(ingredient => ingredient.length > 0);
        } else if (Array.isArray(ingredients)) {
            ingredientsArray = ingredients;
        } else {
            return res.status(400).json({ error: 'Ingredients must be a string or array' });
        }

        const description = await generateDescription(ingredientsArray);
        res.json({ description });
    } catch (error) {
        console.error('Error in route:', error);
        res.status(500).json({ error: 'Failed to generate recipe description' });
    }
});
// Generează descriere pentru o bucătărie
router.post('/generate-cuisine-description', async (req, res) => {
    const { cuisineName } = req.body;

    if (!cuisineName) {
        return res.status(400).json({ error: 'Cuisine name is required' });
    }

    try {
        const description = await generateCuisineDescription(cuisineName);
        res.json({ description });
    } catch (error) {
        console.error('Error in generate-cuisine-description:', error);
        res.status(500).json({ error: 'Failed to generate cuisine description' });
    }
});

router.post('/clarifai-food', async (req, res) => {
    try {
        // Accept both 'image' and 'imageBase64' for flexibility
        let imageBase64 = req.body.imageBase64 || req.body.image;

        if (!imageBase64) {
            return res.status(400).json({ error: 'No imageBase64 or image provided' });
        }

        // elimină prefixul dacă există
        imageBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

        const clarifaiResponse = await axios.post(
            `https://api.clarifai.com/v2/workflows/food/results`,
            {
                inputs: [
                    {
                        data: {
                            image: {
                                base64: imageBase64,
                            },
                        },
                    },
                ],
            },
            {
                headers: {
                    Authorization: `Key ${process.env.CLARIFAI_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                timeout: 15000,
            }
        );

        if (
            !clarifaiResponse.data.results ||
            !clarifaiResponse.data.results[0] ||
            !clarifaiResponse.data.results[0].outputs ||
            clarifaiResponse.data.results[0].outputs.length === 0
        ) {
            return res.status(500).json({ error: 'Clarifai nu a returnat outputs.' });
        }

        const concepts = clarifaiResponse.data.results[0].outputs[0].data.concepts;

        if (!concepts || concepts.length === 0) {
            return res.json({ message: 'Nu s-au detectat ingrediente în imagine.' });
        }

        res.json({ concepts });
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error('Error calling Clarifai API:', error.response?.data || error.message);
            res.status(500).json({
                error: 'Eroare la apelarea Clarifai API',
                details: error.response?.data || error.message,
            });
        } else if (error instanceof Error) {
            console.error('Error calling Clarifai API:', error.message);
            res.status(500).json({
                error: 'Eroare la apelarea Clarifai API',
                details: error.message,
            });
        } else {
            console.error('Error calling Clarifai API:', error);
            res.status(500).json({ error: 'Eroare la apelarea Clarifai API' });
        }
    }
});

//generare meniu sau reteta
router.post('/generate-ai', async (req, res) => {
    const { ingredients, type } = req.body;

    if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
        return res.status(400).json({ message: 'Ingredient list is required.' });
    }

    if (!type || !['menu', 'recipe'].includes(type)) {
        return res.status(400).json({ message: 'Invalid generation type.' });
    }

    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_API_KEY) {
        console.error('Groq API key is not configured.');

        return res.status(500).json({ message: 'Groq API key is not configured.' });
    }

    try {
        // Get all cuisines from database
        const cuisinesResponse = await fetch(`${req.protocol}://${req.get('host')}/api/recipes/cuisines`);

        if (!cuisinesResponse.ok) {
            return res.status(500).json({ message: 'Failed to fetch cuisines.' });
        }

        const cuisines = await cuisinesResponse.json();

        const cuisineList = cuisines.map((c: Cuisine) => `ID: ${c.id}, Name: "${c.name}", Description: "${c.description || 'No description'}"`).join('\n');

        let prompt;
        if (type === 'menu') {
            prompt = `You must generate a full daily menu (breakfast, lunch, dinner) using ONLY the following ingredients: ${ingredients.join(', ')}.

IMPORTANT: You must choose ONE cuisine from this list of available cuisines:
${cuisineList}

Consider the traditional cooking methods, spices, and flavor profiles of the chosen cuisine.

Respond ONLY with valid JSON in the exact structure below. Do not include any extra explanation or text.
The "cuisineId" and "cuisineName" must match exactly one cuisine from the list above.

{
  "cuisineId": 0,
  "cuisineName": "",
  "breakfast": {
    "title": "",
    "description": "",
    "ingredients": "",
    "instructions": "",
    "prepTime": 0,
    "servings": 0
  },
  "lunch": {
    "title": "",
    "description": "",
    "ingredients": "",
    "instructions": "",
    "prepTime": 0,
    "servings": 0
  },
  "dinner": {
    "title": "",
    "description": "",
    "ingredients": "",
    "instructions": "",
    "prepTime": 0,
    "servings": 0
  }
}`;
        } else {
            prompt = `You must generate 3 unique recipes using ONLY the following ingredients: ${ingredients.join(', ')}.

IMPORTANT: You must choose ONE cuisine from this list of available cuisines:
${cuisineList}

Consider the traditional cooking methods, spices, and flavor profiles of the chosen cuisine.

Respond ONLY with valid JSON in the exact structure below. Do not include any extra explanation or text.
The "cuisineId" and "cuisineName" must match exactly one cuisine from the list above.

{
  "cuisineId": 0,
  "cuisineName": "",
  "recipes": [
    {
      "title": "",
      "description": "",
      "ingredients": "",
      "instructions": "",
      "prepTime": 0,
      "servings": 0
    },
    {
      "title": "",
      "description": "",
      "ingredients": "",
      "instructions": "",
      "prepTime": 0,
      "servings": 0
    },
    {
      "title": "",
      "description": "",
      "ingredients": "",
      "instructions": "",
      "prepTime": 0,
      "servings": 0
    }
  ]
}`;
        }
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'llama3-8b-8192',
                messages: [
                    {
                        role: 'system',
                        content: 'You are a professional chef with expertise in multiple cuisines. You must choose the most appropriate cuisine from the provided list based on the available ingredients. Always respond ONLY with valid JSON in the exact format requested. Do not include explanations, headers, or introductions. The cuisineId and cuisineName must exactly match one of the provided cuisines.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 2000
            })
        });

        if (!response.ok) {
            throw new Error(`Groq API error! status: ${response.status}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;

        let parsed;
        try {
            // Attempt direct parse
            parsed = JSON.parse(content);
        } catch {
            // Try to extract just the JSON block using RegExp
            const match = content.match(/\{[\s\S]*\}/);
            if (match) {
                parsed = JSON.parse(match[0]);
            } else {
                throw new SyntaxError('Could not extract valid JSON from AI response.');
            }
        }
        // Validate that the chosen cuisine exists
        const chosenCuisine = cuisines.find((c: Cuisine) => c.id === parsed.cuisineId);
        if (!chosenCuisine) {
            return res.status(500).json({ message: 'AI chose an invalid cuisine.' });
        }

        // Add images to each recipe/menu item
        if (type === 'menu') {
            // Generate images for each meal
            const breakfastImageResponse = await fetch(`${req.protocol}://${req.get('host')}/api/ai/search-image/${encodeURIComponent(parsed.breakfast.title)}/${encodeURIComponent(parsed.cuisineName)}`);
            const breakfastImageData = await breakfastImageResponse.json();

            const lunchImageResponse = await fetch(`${req.protocol}://${req.get('host')}/api/ai/search-image/${encodeURIComponent(parsed.lunch.title)}/${encodeURIComponent(parsed.cuisineName)}`);
            const lunchImageData = await lunchImageResponse.json();

            const dinnerImageResponse = await fetch(`${req.protocol}://${req.get('host')}/api/ai/search-image/${encodeURIComponent(parsed.dinner.title)}/${encodeURIComponent(parsed.cuisineName)}`);
            const dinnerImageData = await dinnerImageResponse.json();

            parsed.breakfast.cuisineId = parsed.cuisineId;
            parsed.breakfast.cuisineName = parsed.cuisineName;
            parsed.breakfast.image = breakfastImageData.image;

            parsed.lunch.cuisineId = parsed.cuisineId;
            parsed.lunch.cuisineName = parsed.cuisineName;
            parsed.lunch.image = lunchImageData.image;

            parsed.dinner.cuisineId = parsed.cuisineId;
            parsed.dinner.cuisineName = parsed.cuisineName;
            parsed.dinner.image = dinnerImageData.image;
        } else {

            // Generate images for each recipe
            for (let i = 0; i < parsed.recipes.length; i++) {
                const recipe = parsed.recipes[i];
                const imageResponse = await fetch(`${req.protocol}://${req.get('host')}/api/ai/search-image/${encodeURIComponent(recipe.title)}/${encodeURIComponent(parsed.cuisineName)}`);

                const text = await imageResponse.text(); // citește ca text

                let imageData;
                try {
                    imageData = JSON.parse(text); // încearcă să parsezi JSON după ce ai văzut textul
                } catch (e) {
                    console.error('Failed to parse image JSON:', e);
                    // fallback la placeholder image
                    imageData = { image: `https://via.placeholder.com/400x300/f0f0f0/666666?text=${encodeURIComponent(recipe.title)}` };
                }
                recipe.cuisineId = parsed.cuisineId;
                recipe.cuisineName = parsed.cuisineName;
                recipe.image = imageData.image;
            }
        }

        res.status(200).json(parsed);

    } catch (error) {
        console.error('AI Recipe Generation Error:', error);

        if (error instanceof SyntaxError) {
            res.status(500).json({ message: 'Error parsing AI response.' });
        } else {
            res.status(500).json({ message: 'Failed to generate recipes.' });
        }
    }
});

router.get('/search-image/:recipeName/:cuisineName', async (req, res) => {
    const { recipeName, cuisineName } = req.params;
    const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
    const GOOGLE_CX = process.env.GOOGLE_CX;

    if (!GOOGLE_API_KEY || !GOOGLE_CX) {
        console.warn('Google API credentials not configured, using placeholder image');
        return res.json({
            image: `https://via.placeholder.com/400x300/f0f0f0/666666?text=${encodeURIComponent(recipeName)}`
        });
    }

    try {
        const searchQuery = `${recipeName} ${cuisineName} food recipe`;
        const response = await fetch(
            `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CX}&q=${encodeURIComponent(searchQuery)}&searchType=image&num=1&imgSize=medium&safe=active&imgType=photo`
        );

        const data = await response.json();

        if (data.items && data.items.length > 0) {
            res.json({ image: data.items[0].link });
        } else {
            res.json({
                image: `https://via.placeholder.com/400x300/f0f0f0/666666?text=${encodeURIComponent(recipeName)}`
            });
        }
    } catch (error) {
        console.error('Error searching for recipe image:', error);
        res.json({
            image: `https://via.placeholder.com/400x300/f0f0f0/666666?text=${encodeURIComponent(recipeName)}`
        });
    }
});

export default router;
