let userId = localStorage.getItem('userId');

function addMessage(sender, message) {
    const chatBox = document.getElementById('chat-box');
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', sender);
    messageDiv.innerHTML = message;
    Prism.highlightAllUnder(chatBox);
    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function addQuickReplies(replies) {
    const quickRepliesContainer = document.getElementById('quick-replies');
    quickRepliesContainer.innerHTML = '';
    replies.forEach(reply => {
        const button = document.createElement('button');
        button.textContent = reply;
        button.addEventListener('click', () => {
            if (reply === 'Playground') togglePlaygroundInput(true);
            else sendMessage(reply);
        });
        quickRepliesContainer.appendChild(button);
    });
}

function togglePlaygroundInput(show) {
    const inputContainer = document.getElementById('user-input-container');
    const playgroundContainer = document.getElementById('playground-container');
    if (show) {
        inputContainer.style.display = 'none';
        playgroundContainer.style.display = 'block';
        document.getElementById('playground-input').focus();
    } else {
        inputContainer.style.display = 'flex';
        playgroundContainer.style.display = 'none';
        document.getElementById('playground-input').value = '';
    }
}

async function sendMessage(message = null) {
    const userInput = document.getElementById('user-input');
    const inputMessage = message || userInput.value.trim();
    if (!inputMessage) {
        addMessage('bot-message', "Please type something!");
        return;
    }
    addMessage('user-message', inputMessage);
    userInput.value = '';
    
    try {
        addMessage('bot-message', "AI.zak is typing...");
        const response = await fetch('/.netlify/functions/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: inputMessage, userId })
        });
        const data = await response.json();
        const chatBox = document.getElementById('chat-box');
        chatBox.lastChild.remove();
        addMessage('bot-message', data.response);
        addQuickReplies(data.quickReplies);
    } catch (error) {
        addMessage('bot-message', "Oops, something went wrong. Try again!");
        console.error('Send message error:', error);
    }
}

async function sendPlaygroundCode() {
    const playgroundInput = document.getElementById('playground-input');
    const code = playgroundInput.value.trim();
    if (!code) {
        addMessage('bot-message', "Please enter some code to run!");
        return;
    }
    addMessage('user-message', `<pre><code class="language-javascript">${code}</code></pre>`);
    try {
        addMessage('bot-message', "Running your code...");
        const response = await fetch('/.netlify/functions/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: `play ${code}`, userId })
        });
        const data = await response.json();
        const chatBox = document.getElementById('chat-box');
        chatBox.lastChild.remove();
        addMessage('bot-message', data.response);
        togglePlaygroundInput(false);
        addQuickReplies(data.quickReplies);
    } catch (error) {
        addMessage('bot-message', "Oops, something went wrong. Try again!");
        console.error('Playground error:', error);
    }
}

async function startNewChat() {
    try {
        await fetch('/.netlify/functions/clear', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
        });
        document.getElementById('chat-box').innerHTML = '';
        addMessage('bot-message', "New chat started! How can AI.zak assist you now?");
        addQuickReplies(["Variables", "Functions", "Loops", "Arrays", "Objects", "Weather", "Joke", "Playground", "Samples", "Iteration", "Code Blocks"]);
    } catch (error) {
        addMessage('bot-message', "Oops, couldn’t start a new chat. Try again!");
        console.error('New chat error:', error);
    }
}

function typePreloader(callback) {
    const preloader = document.getElementById('preloader');
    const preloaderText = document.getElementById('preloader-text');
    preloader.style.display = 'flex';
    const text = "AI.zak";
    let i = 0;

    function type() {
        if (i < text.length) {
            preloaderText.textContent += text[i];
            i++;
            setTimeout(type, 200);
        } else {
            preloaderText.classList.add('typing');
            setTimeout(() => {
                preloader.style.opacity = '0';
                setTimeout(() => {
                    preloader.style.display = 'none';
                    preloader.style.opacity = '1';
                    preloaderText.textContent = '';
                    preloaderText.classList.remove('typing');
                    callback();
                }, 500);
            }, 1000);
        }
    }
    type();
}

function login() {
    const usernameInput = document.getElementById('username-input');
    const username = usernameInput.value.trim();
    if (!username) {
        alert("Please enter a username!");
        return;
    }
    userId = username;
    localStorage.setItem('userId', userId);
    console.log('userId set to:', userId);
    document.getElementById('login-container').style.display = 'none';
    typePreloader(() => {
        console.log('Calling loadChat with userId:', userId);
        document.getElementById('chat-container').style.display = 'block';
        loadChat();
    });
}

function continueAsSaved() {
    document.getElementById('login-container').style.display = 'none';
    document.getElementById('chat-container').style.display = 'block';
    loadChat();
}

async function loadChat() {
    try {
        const response = await fetch(`/.netlify/functions/history?userId=${userId}`);
        const history = await response.json();
        history.forEach(msg => addMessage(msg.sender === 'user' ? 'user-message' : 'bot-message', msg.text));
        addQuickReplies(["Variables", "Functions", "Loops", "Arrays", "Objects", "Weather", "Joke", "Playground", "Samples", "Iteration", "Code Blocks"]);
    } catch (error) {
        console.error('Failed to load history:', error);
    }
}

window.onload = () => {
    const savedUsername = localStorage.getItem('userId');
    if (savedUsername) {
        document.getElementById('saved-username').textContent = savedUsername;
        document.getElementById('continue-option').style.display = 'block';
        document.getElementById('username-input').value = savedUsername;
    }
};

document.getElementById('user-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});
