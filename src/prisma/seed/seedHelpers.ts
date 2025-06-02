import { PrismaClient } from "@prisma/client";
import axios from "axios";
const prisma = new PrismaClient();




export async function generateCuisineDescription(cuisineName: string): Promise<string> {
  const prompt = `
Create a short, natural and inviting description of the "${cuisineName}" cuisine.
Highlight its unique flavor, style, or cultural importance.
Keep it under 25 words.`;

  try {
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "mistralai/mistral-7b-instruct",
        messages: [
          {
            role: "system",
            content: "You are a food writer who crafts enticing descriptions of international cuisines.",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 60,
        temperature: 0.7,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data.choices[0].message.content.trim();
  } catch (err: any) {
    console.error("Error generating cuisine description:", err.response?.data || err.message);
    return "A delicious cuisine worth exploring!";
  }
}
