// backend/src/routes/aiRoutes.ts
import express from 'express';
import generateDescription from '../prisma/seed/generateDescription';
import {generateCuisineDescription}  from '../prisma/seed/seedHelpers';
import axios from 'axios';

const router = express.Router();

// Endpoint pentru generare descriere rețetă
router.post('/generate-recipe-description', async (req, res) => {
  const { ingredients } = req.body;

  if (!ingredients || !Array.isArray(ingredients)) {
    return res.status(400).json({ error: 'Ingredients are required' });
  }

  try {
    const description = await generateDescription(ingredients);
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
  console.log('Received request body:', req.body);

  try {
    // Accept both 'image' and 'imageBase64' for flexibility
    let imageBase64 = req.body.imageBase64 || req.body.image;

    if (!imageBase64) {
      return res.status(400).json({ error: 'No imageBase64 or image provided' });
    }

    // elimină prefixul dacă există
    imageBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    console.log('Calling Clarifai API...');

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

    // Log răspuns complet pt debugging
    console.log('Clarifai response:', JSON.stringify(clarifaiResponse.data, null, 2));

    // Corect: verifică existența în results[0].outputs
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



export default router;
