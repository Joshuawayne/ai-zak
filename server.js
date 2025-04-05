require('dotenv').config(); // Load environment variables from .env
const express = require('express');
const axios = require('axios');
const { VM } = require('vm2');
const { Database } = require('./database');
const app = express();
const port = process.env.PORT || 3000; // Use PORT from .env or default to 3000

app.use(express.json());
app.use(express.static('public'));

const GEMINI_API_KEY = process.env.GEMINI_API_KEY; // From .env
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent';
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY; // From .env

// Database setup
const db = new Database();

// Dynamic Weather API
async function fetchWeatherData(city) {
    try {
        const response = await axios.get(
            `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${OPENWEATHER_API_KEY}&units=metric`
        );
        return {
            temperature: response.data.main.temp,
            condition: response.data.weather[0].description
        };
    } catch (error) {
        return { temperature: "unknown", condition: "unavailable" };
    }
}

// JS Playground
function runPlayground(code) {
    const logs = [];
    const sandbox = {
        console: {
            log: (...args) => logs.push(args.map(String).join(' '))
        }
    };
    const vm = new VM({
        timeout: 1000,
        sandbox: sandbox
    });

    try {
        const result = vm.run(code);
        let output = logs.length > 0 ? logs.join('\n') : '';
        if (result !== undefined) {
            output += (output ? '\n' : '') + String(result);
        }
        return output || 'No output';
    } catch (error) {
        return `Error: ${error.message}`;
    }
}

// Sample code snippets
const sampleSnippets = [
    "let x = 5;\nconsole.log('Value of x:', x);",
    "for (let i = 0; i < 3; i++) {\n    console.log('Loop iteration:', i);\n}",
    "function sayHello(name) {\n    console.log('Hello, ' + name);\n}\nsayHello('friend');"
];

// Educational explanations
const explanations = {
    "iteration": "Iteration in JavaScript means repeating a block of code multiple times. For example, a <code>for</code> loop iterates over numbers: <pre>for (let i = 0; i < 3; i++) {\n    console.log(i);\n}</pre> This runs 3 times, printing 0, 1, 2.",
    "code blocks": "A code block in JavaScript is a group of statements enclosed in curly braces <code>{}</code>. It’s used to group code, like in functions or loops: <pre>if (true) {\n    console.log('This is a block');\n}</pre> Blocks help organize and scope your code.",
    "variables": "Variables in JavaScript store data you can use later. Use <code>let</code>, <code>const</code>, or <code>var</code>: <pre>let age = 25;\nconsole.log(age);</pre> <code>let</code> can change, <code>const</code> can’t.",
    "functions": "Functions are reusable blocks of code that perform a task. Define them with <code>function</code>: <pre>function greet(name) {\n    console.log('Hi, ' + name);\n}\ngreet('Zak');</pre> They can take inputs and return values.",
    "arrays": "Arrays store multiple values in a single variable. Use square brackets: <pre>let fruits = ['apple', 'banana'];\nconsole.log(fruits[0]);</pre> Access items by index (starting at 0)."
};

// Chat endpoint
app.post('/chat', async (req, res) => {
    const { message, userId = 'guest' } = req.body;
    const lowerMessage = message.toLowerCase();
    let response = "Hi! I'm AI.zak, here to help with JavaScript or anything else! What’s on your mind?";

    try {
        const history = await db.getHistory(userId);
        let context = history.slice(-2).map(msg => `${msg.sender}: ${msg.text}`).join('\n');

        if (lowerMessage.includes("weather")) {
            let city = "London";
            const weatherMatch = lowerMessage.match(/weather\s*(in)?\s*([a-zA-Z\s]+)/i);
            if (weatherMatch && weatherMatch[2]) {
                city = weatherMatch[2].trim();
            }
            const weatherData = await fetchWeatherData(city);
            if (weatherData.temperature === "unknown") {
                response = `Sorry, I couldn’t get the weather for ${city}. Try another city!`;
            } else {
                response = `The current weather in ${city} is ${weatherData.temperature}°C with ${weatherData.condition}.`;
            }
        } else if (lowerMessage.startsWith("run ")) {
            const code = message.slice(4);
            const vm = new VM({ timeout: 1000, sandbox: {} });
            try {
                const result = vm.run(code);
                response = `Result: ${result}`;
            } catch (error) {
                response = `Error: ${error.message}`;
            }
        } else if (lowerMessage.startsWith("play ")) {
            const code = message.slice(5);
            response = `<pre>${runPlayground(code)}</pre>`;
        } else if (lowerMessage === "samples") {
            response = "Here are some JS snippets to try in the playground:\n" +
                sampleSnippets.map((snippet, i) => `<pre>Sample ${i + 1}:\n${snippet}</pre>`).join('\n');
        } else if (lowerMessage === "new chat") {
            await db.clearHistory(userId);
            response = "New chat started! How can AI.zak assist you now?";
        } else if (explanations[lowerMessage]) {
            response = explanations[lowerMessage];
        } else {
            const aiResponse = await axios.post(
                GEMINI_API_URL,
                {
                    contents: [{
                        parts: [{
                            text: `${context}\nUser: ${message}\nBot:`
                        }]
                    }]
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'x-goog-api-key': GEMINI_API_KEY
                    }
                }
            );
            response = aiResponse.data.candidates[0].content.parts[0].text;
        }

        await db.saveMessage(userId, 'user', message);
        await db.saveMessage(userId, 'bot', response);

        res.json({
            response,
            quickReplies: ["Variables", "Functions", "Loops", "Arrays", "Objects", "Weather", "Joke", "Playground", "Samples", "Iteration", "Code Blocks"]
        });
    } catch (error) {
        console.error('Chat processing error:', error);
        res.status(500).json({ response: "Sorry, something went wrong!", quickReplies: [] });
    }
});

// History endpoint
app.get('/history', async (req, res) => {
    const userId = req.query.userId || 'guest';
    try {
        const history = await db.getHistory(userId);
        res.json(history);
    } catch (error) {
        console.error('History fetch error:', error);
        res.status(500).json([]);
    }
});

// Clear history endpoint
app.post('/clear', async (req, res) => {
    const { userId } = req.body;
    try {
        await db.clearHistory(userId);
        res.json({ success: true });
    } catch (error) {
        console.error('Clear history error:', error);
        res.status(500).json({ success: false });
    }
});

const server = app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
process.on('SIGINT', () => {
    console.log('Shutting down server...');
    db.close();
    server.close(() => {
        console.log('Server stopped');
        process.exit(0);
    });
});
