import { GoogleGenAI, Type } from "@google/genai";
import { INITIAL_DOCTOR_INSTRUCTION, SCHEMA, USER_FRAMING_STRING } from "./prompt.js"
import * as dotenv from "dotenv"
import { getMessage } from "../routes/aiRoutes.js";


dotenv.config()

const ai = new GoogleGenAI({
    apiKey : process.env.GEMINI_API_KEY
});

export async function callModel(sessionID, user_query, isContextToBeTaken){
    let chatMessages ;

    if(isContextToBeTaken){
        const history = getMessage()
        chatMessages = history 
    }
    console.log(chatMessages)
    const chat = await ai.chats.create({
        model : "gemini-2.5-flash",
        history : typeof(chatMessages) == "object" ? chatMessages.map((m=>({
            role : m.role,
            parts : [{
                text : m.content
            }]
        }))) : [{
            role : "user",
            parts : [{
                text : `${USER_FRAMING_STRING} ${user_query}`
            }]
        }],
        config: {
            systemInstruction: INITIAL_DOCTOR_INSTRUCTION(),
            responseMimeType : "application/json",
            responseSchema : SCHEMA
        },
    })
    const response = await chat.sendMessage({
        message : `${USER_FRAMING_STRING} ${String(user_query)}`
    })
    
    const parsedResponse = JSON.parse(response.text)

    console.log(parsedResponse)

    return parsedResponse[0]

}