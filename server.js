require('dotenv').config()

const express = require('express')
const axios = require('axios')
const { GoogleGenAI } = require('@google/genai')
const cors = require('cors')
const admin = require('firebase-admin')

// const serviceAccount = require(process.env.GOOGLE_APPLICATION_CREDENTIALS); 

const serviceAccount = {
  type: 'service_account',
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g,'\n'),
  // private_key: JSON.parse(`"${process.env.PRIVATE_KEY}"`),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: process.env.FIREBASE_AUTH_URI,
  token_uri: process.env.FIREBASE_TOKEN_URI,
  auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
  client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
  universe_domain: process.env.FIREBASE_UNIVERSE_DOMAIN
};



admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});



const db = admin.firestore();
const port = process.env.PORT || 3000
const app = express()

app.use(express.json());
app.use(cors()); 



const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });


app.post('/generate-trip', async(req,res)=>{
    let tripplan = "";
    const  {destination, days, budget, members, userId} = req.body;

    
      const parseduser  = JSON.parse(userId)
    
    
    if (!destination || !days || !budget || !members) {
        return res.status(400).json({ error: "All fields are required" });
    }

    try{
        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            // contents: `Generate a trip plan for ${destination} for ${days} days with a budget of ${budget} for ${members} people. Give me the hotels option list with hotel name , hotel address , hotel price, and hotel image url, along with the geo coordinates , description,and suggest itinerary with placename, place address, place details, place image url, geo coordinates, ticket pricing, time to travel for each of the location for ${days} with each day plan with the best time to visit.all this information  i need it in  a json format`,
            contents: `Generate a trip plan for ${destination} for ${days} days with a budget of ${budget} for ${members} people. 
            Give me only a valid JSON response without any extra text and also give me "valid and working " image url for the image of the location and multiple hotels recomend atleast 5 hotels to stay   and suggest atleast 3 to 4  places per day . The JSON should include:
            {
            "hotels": [ { "name": "Hotel X", "address": "XYZ", "price": 100, "image_url": "URL", "geo": { "lat": 0, "lng": 0 } },
                        {"name": "Hotel y", "address": "XYZ", "price": 100, "image_url": "URL", "geo": { "lat": 0, "lng": 0 }},
                        {"name": "Hotel z", "address": "XYZ", "price": 100, "image_url": "URL", "geo": { "lat": 0, "lng": 0 }}
                     ],
            "itinerary": [ { "day": 1, "places": [ { "name": "Place A", "address": "XYZ", "details": "desc", "image_url": "URL", "geo": { "lat": 0, "lng": 0 }, "ticket_price": 10, "travel_time": "30 mins" } ] } ]
            }`
        });

        const responseText = response.text;
        const jsonStart = responseText.indexOf("{");
        const jsonEnd = responseText.lastIndexOf("}");

        if (jsonStart !== -1 && jsonEnd !== -1) {
            tripplan = JSON.parse(responseText.substring(jsonStart, jsonEnd + 1).trim());
        }
        
        let tripId = Date.now().toString();

        // save trip to firease 

        await db.collection("AiGeneratedTrips").doc(tripId).set({
            tripId,
            userId : parseduser,
            destination,
            days,
            budget,
            members,
            tripplan,
            createdAt: admin.firestore.Timestamp.now()
        })
        console.log(" success at server end")
        console.log(tripId)
        res.json({"message" : "successfully stored in db" , "success" : true, "docId" : tripId}) 
    }catch(err){
        console.error(err)
        res.status(500).json({ error: "Failed to generate trip plan" });
    }
})


app.get('/image', async (req, res) => {
    const imageurl = req.query.url;
    if (!imageurl || !imageurl.startsWith("http")) {
      console.error("❌ Invalid image URL received on backend:", imageurl);
      return res.status(400).send("Invalid image URL");
    }
  
    try {
      const response = await axios({
        method: 'GET',
        url: imageurl,
        responseType: 'stream',
      });
  
      res.setHeader('Content-Type', response.headers['content-type']);
      response.data.pipe(res);
    } catch (error) {
      console.error('Error fetching image:', error.message);
      res.status(500).send('Failed to fetch image');
    }
  });
  

app.listen(port,()=>{
    console.log("server is listning...!!!")
})

