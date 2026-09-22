import { GoogleGenAI, Type } from "@google/genai";
import { CONFIGS } from "./config.ts";

function calculator(operation: string, operand1: number, operand2: number) {
  switch (operation) {
    case "add":
      return operand1 + operand2;
    case "subtract":
      return operand1 - operand2;
    case "multiply":
      return operand1 * operand2;
    case "divide":
      return operand2 === 0 ? "Cannot divide by zero" : operand1 / operand2;
    default:
      return "Invalid operation";
  }
}

const ai = new GoogleGenAI({
  apiKey: CONFIGS.GEMINI_API_KEY,
});

const calculatorDeclaration = {
  name: "calculator",
  description: "A simple calculator that performs basic arithmetic operations.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      operation: {
        type: Type.STRING,
        enum: ["add", "subtract", "multiply", "divide"],
        description: "The arithmetic operation to perform.",
      },
      operand1: { type: Type.NUMBER, description: "The first operand." },
      operand2: { type: Type.NUMBER, description: "The second operand." },
    },
    required: ["operation", "operand1", "operand2"],
  },
};

const response = await ai.models.generateContent({
  model: "gemini-3.6-flash",
  contents: "Multiply 1984135 by 9343116. Only respond with the result",
  config: {
    tools: [{ functionDeclarations: [calculatorDeclaration] }],
  },
});

console.log(response.functionCalls);

const call = response.functionCalls?.[0];
const args = call?.args;
if (
  call?.name === "calculator" &&
  args &&
  typeof args.operation === "string" &&
  typeof args.operand1 === "number" &&
  typeof args.operand2 === "number"
) {
  const result = calculator(args.operation, args.operand1, args.operand2);
  console.log("RESULT IS", result); // 18538003464660
}
