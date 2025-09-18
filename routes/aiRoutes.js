import express from "express"
import { v4 as uuid}  from "uuid"
import { callModel } from "../ai/model.js"
import { USER_FRAMING_STRING } from "../ai/prompt.js"
const router =  express.Router()


let CHAT_HISTORY = []
// will implement redis fo =r caching later


function saveMessage(role, content){
    CHAT_HISTORY.push({
        role : role, 
        content : content
    })
}

export function getMessage(role, content){
    return CHAT_HISTORY
}

router.post("/start", async (req, res) => {
    // get the symptoms
    const { symptoms} = req.body
    if(!symptoms || symptoms == ""){
        return res.status(403).json({
            msg : "error",
            data : []
        })
    }

    // generate unique sessionId
    try {
        const session_id = uuid()
        // save the symptoms to the redis cache
        saveMessage("user", `${USER_FRAMING_STRING} ${String(symptoms)}`)
        
        // save the user info and the conversation in the db

        // get the response from the model
        const llm_response = await callModel(session_id, symptoms, false)

        if(!llm_response){
            return res.status(500).json({
                msg : "error",
                data :[]
            })
        }

        const framed_output = {
            next_question : llm_response.followup_question,
            isEmergency : llm_response.isEmergency ? true : false,
            isConversationEnded : llm_response.isConversationEnded ? true : false,
            finalize : llm_response.final_response != "" ? llm_response.final_response : "",
            clarification : llm_response.clarification_if_emergency != "" ? llm_response.clarification_if_emergency : ""
        }
        
        
        // save the response in the redis cache
        // await saveMessage(session_id, "model", framed_output.next_queston)
        saveMessage("model", framed_output.next_question)
        
        // return the response
        return res.status(200).json({
            msg : "data recieved",
            data : [{
                session_id,
                response : framed_output
            }]
        })
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            mgs : "error",
            data:[]
        })
    }
})

router.post('/follow-up' , async (req, res) => {
    const { session_id = "random", answer } = req.body

    if(!session_id || session_id == "" || !answer || answer == "") {
        return res.status(403).json({
            msg : "error occurred. Invalid payload",
            data : []
        })
    }

    try{
        // save the user query in the cache
        // await saveMessage(session_id, "user", `${String(USER_FRAMING_STRING)} ${String(answer)}`)
        saveMessage("user", `${String(USER_FRAMING_STRING)} ${String(answer)}`)

        // get the previous context

        // load the context into the model and then get the response
        const llm_response  = await callModel(session_id, answer, true)

        if(!llm_response){
            console.log(llm_response)
            return res.status(500).json({
                msg : "error",
                data :[]
            })
        }
        // get the llm response
        const framed_output = {
            next_queston : llm_response.followup_question,
            isConversationEnded : llm_response.isConversationEnded ? true : false, 
            isEmergency : llm_response.isEmergency ? true : false,
            finalize : llm_response.final_response != "" ? llm_response.final_response : "",
            clarification : llm_response.clarification_if_emergency != "" ? llm_response.clarification_if_emergency : ""
        }
        
        // save the response in the cache
        saveMessage( "model", framed_output.next_queston)
        
        // update the user conversation in the db

        
        // if(framed_output.isConversationEnded) await clearMessage(session_id)
        // return the output
        return res.status(200).json({
            msg : "data recieved",
            data : [{
                response : framed_output
            }]
        })
    }catch(err){
        console.log(err)

        return res.status(500).json({
            msg : "error occurred",
            data : []
        })
    }
})

export default router