import { GoogleGenAI, Type } from "@google/genai";
import { CONFIGS } from "./config.ts";

async function getStockPrice(company: string) {
  return { symbol: "GM", price: 43.09 };
}

const ai = new GoogleGenAI({
  apiKey: CONFIGS.GEMINI_API_KEY,
});

const getStockPriceDeclaration = {
  name: "getStockPrice",
  description: "Retrieves the current stock price for a given company",
  parameters: {
    type: Type.OBJECT,
    properties: {
      company: {
        type: Type.STRING,
        description: "The company name to fetch stock data for",
      },
    },
    required: ["company"],
  },
};

const response = await ai.models.generateContent({
  model: "gemini-3.6-flash",
  contents: "How many shares of General Motors can I buy with $500?",
  config: {
    tools: [{ functionDeclarations: [getStockPriceDeclaration] }],
  },
});

const call = response.functionCalls?.[0];
const company = call?.args?.company;
if (typeof company !== "string") {
  throw new Error("모델이 getStockPrice 함수 호출을 반환하지 않았습니다");
}

const result = await getStockPrice(company);

const modelTurn = response.candidates?.[0]?.content;
if (!modelTurn) {
  throw new Error("모델 응답에 content가 없습니다");
}

console.log(call);
console.log(response);
console.log(modelTurn);

const finalResponse = await ai.models.generateContent({
  model: "gemini-3.6-flash",
  contents: [
    { role: "user", parts: [{ text: "How many shares of General Motors can I buy with $500?" }] },
    modelTurn, // 모델의 functionCall 턴
    {
      role: "user",
      parts: [
        {
          functionResponse: {
            name: "getStockPrice",
            response: { result },
          },
        },
      ],
    },
  ],
  config: { tools: [{ functionDeclarations: [getStockPriceDeclaration] }] },
});

console.log(finalResponse.text);
