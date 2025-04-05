require('dotenv').config(); // Optional for local testing, not needed on Netlify
const axios = require('axios');
const { VM } = require('vm2');
const sqlite3 = require('sqlite3').verbose();

exports.handler = async (event, context) => {
    const { Database } = require('../database');
    const db = new Database();

    const { httpMethod, body, queryStringParameters, path } = event;
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY; // From Netlify env vars
    const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent';
    const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY; // From Netlify env vars

    try {
        if (httpMethod === 'POST' && path === '/chat') {
            const { message, userId = 'guest' } = JSON.parse(body);
            const lowerMessage = message.toLowerCase();
            let response = "Hi! I'm AI.zak, here to help with JavaScript or anything else! What’s on your mind?";

            const history = await db.getHistory(userId);
            let context = history.slice(-2).map(msg => `${msg.sender}: ${msg.text}`).join('\n');

            if (lowerMessage.includes("weather")) {
                let city = "London";
                const weatherMatch = lowerMessage.match(/weather\s*(in)?\s*([a-zA-Z\s]+)/i);
                if (weatherMatch && weatherMatch[2]) city = weatherMatch[2].trim();
                const weatherData = await fetchWeatherData(city);
                response = weatherData.temperature === "unknown" 
                    ? `Sorry, I couldn’t get the weather for ${city}. Try another city!`
                    : `The current weather in ${city} is ${weatherData.temperature}°C with ${weatherData.condition}.`;
            } else if (lowerMessage.startsWith("play ")) {
                const code = message.slice(5);
                response = `<pre>${runPlayground(code)}</pre>`;
            } else if (lowerMessage === "new chat") {
                await db.clearHistory(userId);
                response = "New chat started! How can AI.zak assist you now?";
            } else {
                const aiResponse = await axios.post(
                    GEMINI_API_URL,
                    { contents: [{ parts: [{ text: `${context}\nUser: ${message}\nBot:` }] }] },
                    { headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY } }
                );
                response = aiResponse.data.candidates[0].content.parts[0].text;
            }

            await db.saveMessage(userId, 'user', message);
            await db.saveMessage(userId, 'bot', response);

            return {
                statusCode: 200,
                body: JSON.stringify({
                    response,
                    quickReplies: ["Variables", "Functions", "Loops", "Arrays", "Objects", "Weather", "Joke", "Playground", "Samples", "Iteration", "Code Blocks"]
                })
            };
        } else if (httpMethod === 'GET' && path === '/history') {
            const userId = queryStringParameters.userId || 'guest';
            const history = await db.getHistory(userId);
            return { statusCode: 200, body: JSON.stringify(history) };
        } else if (httpMethod === 'POST' && path === '/clear') {
            const { userId } = JSON.parse(body);
            await db.clearHistory(userId);
            return { statusCode: 200, body: JSON.stringify({ success: true }) };
        }

        return { statusCode: 404, body: JSON.stringify({ error: 'Not Found' }) };
    } catch (error) {
        console.error('Error:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) };
    } finally {
        db.close();
    }
};

async function fetchWeatherData(city) {
    try {
        const response = await axios.get(
            `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${process.env.OPENWEATHER_API_KEY}&units=metric`
        );
        return {
            temperature: response.data.main.temp,
            condition: response.data.weather[0].description
        };
    } catch (error) {
        return { temperature: "unknown", condition: "unavailable" };
    }
}

function runPlayground(code) {
    const logs = [];
    const sandbox = { console: { log: (...args) => logs.push(args.map(String).join(' ')) } };
    const vm = new VM({ timeout: 1000, sandbox });
    try {
        const result = vm.run(code);
        let output = logs.length > 0 ? logs.join('\n') : '';
        if (result !== undefined) output += (output ? '\n' : '') + String(result);
        return output || 'No output';
    } catch (error) {
        return `Error: ${error.message}`;
    }
}
