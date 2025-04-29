import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const openRouterApiKey = process.env.OPENROUTER_API_KEY!; // folosește cheia de la OpenRouter

const generateDescription = async (ingredients: string[]): Promise<string> => {
  const prompt = `
Create a short, natural and appetizing description for a recipe made using the following ingredients: ${ingredients.join(", ")}.
If the ingredient list is short (less than 4 items), focus on highlighting the main flavors.
If the ingredient list is long, emphasize the richness and diversity of tastes.
Make the description sound enticing, like something you'd say to recommend a dish to a friend.
Keep it under 20 words.
Example: "A refreshing dessert bursting with sweet strawberry notes."
`;

  try {
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'mistralai/mistral-7b-instruct', // Poți alege alt model suportat de OpenRouter
        messages: [
          { role: 'system', content: 'You are a gourmet chef who writes mouth-watering recipe descriptions.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 60,
        temperature: 0.7
      },
      {
        headers: {
          'Authorization': `Bearer ${openRouterApiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data.choices[0].message.content.trim();
  } catch (err: any) {
    console.error('Error generating description:', err.response?.data || err.message);
    return "A tasty recipe!";
  }
};

export default generateDescription;
